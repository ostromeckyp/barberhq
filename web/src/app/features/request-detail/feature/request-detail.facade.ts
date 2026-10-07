import { Service, inject, computed, resource, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ReplenishmentApi } from '../../replenishment/data-access/replenishment-api';
import { SessionFacade } from '../../auth/feature/session.facade';
import { BrowserActivity } from '../../../core/browser-activity';
import { RequestActions } from './request-actions';
import type { TransitionType } from './action-input';
@Service({ autoProvided: false })
export class RequestDetailFacade {
  private readonly api = inject(ReplenishmentApi);
  private readonly session = inject(SessionFacade);
  private readonly activity = inject(BrowserActivity);
  private readonly actions = inject(RequestActions);
  private readonly id = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('requestId'))),
  );
  private readonly record = resource({
    params: () => {
      const s = this.session.state(),
        id = this.id();
      return s.status === 'READY' && id
        ? { id, uid: s.membership.userId, tick: this.activity.refreshTick() }
        : undefined;
    },
    loader: ({ params }) => this.api.getRequest(params.id),
  });
  readonly request = computed(() => (this.record.hasValue() ? this.record.value() : undefined));
  readonly loading = this.record.isLoading;
  readonly error = computed(() => !!this.record.error());
  readonly message = signal('');
  readonly availableActions = computed(() => {
    const r = this.request(),
      s = this.session.state();
    if (!r || s.status !== 'READY') return [] as TransitionType[];
    return s.membership.role === 'HQ'
      ? ((r.state === 'PENDING_APPROVAL'
          ? ['APPROVE', 'REJECT']
          : r.state === 'RESERVED'
            ? ['DISPATCH']
            : []) as TransitionType[])
      : r.state === 'DISPATCHED'
        ? (['RECEIVE'] as TransitionType[])
        : [];
  });
  readonly transit = computed(() => {
    const r = this.request();
    return r ? r.items.reduce((sum, i) => sum + i.dispatchedQuantity - i.receivedQuantity, 0) : 0;
  });
  async act(type: TransitionType) {
    const r = this.request();
    if (!r || !this.availableActions().includes(type)) return;
    const outcome = await this.actions.open(r, type);
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
