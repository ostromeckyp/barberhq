import { Service, inject, computed, resource, signal, effect } from '@angular/core';
import { Location } from '@angular/common';
import { parseListContext, requestReturnContext } from '../../../core/request-navigation';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ReplenishmentApi } from '../../replenishment/data-access/replenishment-api';
import { SessionFacade } from '../../auth/feature/session.facade';
import { BrowserActivity } from '../../../core/browser-activity';
import { RequestActions } from './request-actions';
import { availableRequestActions, type TransitionType } from './action-input';
@Service({ autoProvided: false })
export class RequestDetailFacade {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly route = inject(ActivatedRoute);
  readonly workspace: 'HQ' | 'SALON' | undefined = this.route.snapshot.data['workspace'];
  private readonly routeSalonId = toSignal(this.route.paramMap.pipe(map((p) => p.get('salonId'))));
  private readonly candidate = parseListContext(
    (this.location.getState() as { listContext?: unknown })?.listContext,
  );
  private readonly api = inject(ReplenishmentApi);
  private readonly session = inject(SessionFacade);
  private readonly activity = inject(BrowserActivity);
  private readonly actions = inject(RequestActions);
  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('requestId'))));
  private readonly record = resource({
    params: () => {
      const s = this.session.state(),
        id = this.id();
      return s.status === 'READY' && id
        ? {
            id,
            uid: s.membership.userId,
            businessId: s.membership.businessId,
            salonId: this.routeSalonId(),
            tick: this.activity.refreshTick(),
          }
        : undefined;
    },
    loader: async ({ params }) => {
      const request = await this.api.getRequest(params.id);
      if (params.salonId && request.salonId !== params.salonId)
        throw new Error('Request outside this salon');
      return request;
    },
  });
  readonly request = computed(() => (this.record.hasValue() ? this.record.value() : undefined));
  readonly back = computed(() => {
    const r = this.request(),
      s = this.session.state();
    if (!r || s.status !== 'READY' || !s.membership.salonIds.includes(r.salonId)) return undefined;
    return requestReturnContext(
      r,
      s.membership,
      this.candidate,
      this.workspace ?? this.candidate?.kind ?? s.membership.role,
    );
  });
  constructor() {
    effect(() => {
      const r = this.request();
      const back = this.back();
      if (r && back && !this.workspace) {
        void this.router.navigate(
          back.kind === 'HQ' ? ['/hq', 'requests', r.id] : ['/salons', r.salonId, 'requests', r.id],
          {
            replaceUrl: true,
            state: { listContext: back },
          },
        );
      }
    });
  }
  goBack() {
    const c = this.back();
    if (c)
      void this.router.navigate(c.kind === 'HQ' ? ['/hq'] : ['/salons', c.salonId, 'requests'], {
        queryParams:
          c.kind === 'HQ' ? { offset: c.offset } : { filter: c.filter, offset: c.offset },
      });
  }
  readonly loading = this.record.isLoading;
  readonly error = computed(() => !!this.record.error());
  readonly message = signal('');
  readonly availableActions = computed(() => {
    const r = this.request(),
      s = this.session.state();
    if (!r || s.status !== 'READY' || !this.workspace) return [] as TransitionType[];
    return availableRequestActions(s.membership, r, this.workspace);
  });
  readonly transit = computed(() => {
    const r = this.request();
    return r ? r.items.reduce((sum, i) => sum + i.dispatchedQuantity - i.receivedQuantity, 0) : 0;
  });
  async act(type: TransitionType) {
    const r = this.request();
    if (!r || !this.availableActions().includes(type)) return;
    const identity = this.session.state();
    const outcome = await this.actions.open(r, type);
    if (this.id() !== r.id || this.session.state() !== identity) return;
    if (!outcome) return;
    if (outcome) {
      this.message.set(
        outcome.error ??
          (outcome.result?.replayed ? 'This action was already recorded.' : 'Action recorded.'),
      );
    }
    this.refresh();
  }
  refresh() {
    this.record.reload();
  }
}
