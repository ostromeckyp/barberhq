import { Service, computed, inject, resource } from '@angular/core';
import { ClientLog } from '../../../core/client-log';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { SessionFacade } from '../../auth/feature/session.facade';
import { ReplenishmentApi } from '../../replenishment/data-access/replenishment-api';
import { BrowserActivity } from '../../../core/browser-activity';
import { pageOffset, requestFilter } from '../../../core/request-navigation';
import type { RequestFilter } from '../../../../../../shared/contracts/stock/index';
@Service({ autoProvided: false })
export class SalonRequestsFacade {
  private readonly route = inject(ActivatedRoute);
  private readonly log = inject(ClientLog);
  private readonly router = inject(Router);
  private readonly api = inject(ReplenishmentApi);
  private readonly session = inject(SessionFacade);
  private readonly activity = inject(BrowserActivity);
  private readonly params = toSignal(this.route.paramMap);
  private readonly query = toSignal(this.route.queryParamMap);
  readonly context = computed(() => ({
    kind: 'SALON' as const,
    salonId: this.params()?.get('salonId') ?? '',
    filter: requestFilter(this.query()?.get('filter')),
    offset: pageOffset(this.query()?.get('offset')),
  }));
  private readonly scope = computed(() => {
    const s = this.session.state(),
      context = this.context();
    return s.status === 'READY' && s.membership.salonIds.includes(context.salonId)
      ? { ...context, userId: s.membership.userId, businessId: s.membership.businessId }
      : undefined;
  });
  private readonly page = resource({
    params: () => {
      const scope = this.scope();
      return scope ? { scope, tick: this.activity.refreshTick() } : undefined;
    },
    loader: async ({ params }) => ({
      scope: params.scope,
      page: await this.log.step('request.list.load', () =>
        this.api.listRequests(params.scope.salonId, params.scope.filter, {
          offset: params.scope.offset,
          limit: 50,
        }),
      ),
    }),
  });
  private readonly current = computed(() =>
    this.page.hasValue() && this.page.value().scope === this.scope()
      ? this.page.value().page
      : undefined,
  );
  readonly items = computed(() => this.current()?.items ?? []);
  readonly loading = this.page.isLoading;
  readonly error = computed(() => !!this.page.error());
  readonly nextOffset = computed(() => this.current()?.nextOffset ?? null);
  setFilter(filter: RequestFilter) {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { filter: requestFilter(filter), offset: 0 },
    });
  }
  goToPage(offset: number) {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { filter: this.context().filter, offset: pageOffset(offset) },
    });
  }
  refresh() {
    this.page.reload();
  }
}
