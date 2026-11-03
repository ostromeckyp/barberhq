import { ActivatedRoute, Router } from '@angular/router';
import { ClientLog } from '../../../core/client-log';
import { toSignal } from '@angular/core/rxjs-interop';
import { pageOffset } from '../../../core/request-navigation';
import { Service, inject, computed, linkedSignal, resource } from '@angular/core';
import { SessionFacade } from '../../auth/feature/session.facade';
import { BrowserActivity } from '../../../core/browser-activity';
import { ReplenishmentApi } from '../../replenishment/data-access/replenishment-api';
import type { RequestSummary } from '../../../../../../shared/contracts/stock/index';
@Service({ autoProvided: false })
export class HqQueueFacade {
  private readonly api = inject(ReplenishmentApi);
  private readonly session = inject(SessionFacade);
  private readonly activity = inject(BrowserActivity);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly log = inject(ClientLog);
  private readonly query = toSignal(this.route.queryParamMap);
  readonly offset = computed(() => pageOffset(this.query()?.get('offset')));
  private readonly page = resource({
    params: () => {
      const s = this.session.state();
      return s.status === 'READY' && s.membership.role === 'HQ'
        ? {
            uid: s.membership.userId,
            businessId: s.membership.businessId,
            offset: this.offset(),
            tick: this.activity.refreshTick(),
          }
        : undefined;
    },
    loader: ({ params }) =>
      this.log.step('hq.queue.load', () =>
        this.api.listHQQueue({ offset: params.offset, limit: 50 }),
      ),
  });
  /** Last loaded rows; kept while a reload runs so sections never flash an empty state. */
  readonly rows = linkedSignal<RequestSummary[] | undefined, RequestSummary[]>({
    source: () => (this.page.hasValue() ? this.page.value().items : undefined),
    computation: (items, previous) => items ?? previous?.value ?? [],
  });
  readonly loading = this.page.isLoading;
  /** True once a page has loaded, and stays true across later reloads; counts and empty text wait for it. */
  readonly loaded = linkedSignal<boolean, boolean>({
    source: () => this.page.hasValue(),
    computation: (has, previous) => has || (previous?.value ?? false),
  });
  readonly error = computed(() => !!this.page.error());
  readonly pending = computed(() => this.rows().filter((r) => r.state === 'PENDING_APPROVAL'));
  readonly reserved = computed(() => this.rows().filter((r) => r.state === 'RESERVED'));
  readonly other = computed(() =>
    this.rows().filter((r) => !['PENDING_APPROVAL', 'RESERVED'].includes(r.state)),
  );
  readonly hasNext = computed(() => this.page.hasValue() && this.page.value().nextOffset !== null);
  refresh() {
    this.page.reload();
  }
  next() {
    if (this.hasNext()) this.go(this.offset() + 50);
  }
  private go(offset: number) {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { offset } });
  }
  previous() {
    this.go(Math.max(0, this.offset() - 50));
  }
}
