import { Service, computed, inject, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { SessionFacade } from '../../auth/feature/session.facade';
import { SalonContext } from '../../../core/salon-context';
import { BrowserActivity } from '../../../core/browser-activity';
import { pageOffset } from '../../../core/request-navigation';
import { DeliveryApi } from '../data-access/delivery-api';
@Service({ autoProvided: false })
export class DeliveryIssuesFacade {
  private readonly api = inject(DeliveryApi);
  private readonly session = inject(SessionFacade);
  private readonly workspace = inject(SalonContext);
  private readonly activity = inject(BrowserActivity);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly query = toSignal(this.route.queryParamMap);
  readonly selected = computed(() => this.query()?.get('view') === 'delivery-issues');
  readonly status = computed<'OPEN' | 'ALL'>(() =>
    this.query()?.get('issueStatus') === 'ALL' ? 'ALL' : 'OPEN',
  );
  readonly offset = computed(() => pageOffset(this.query()?.get('issueOffset')));
  private readonly identity = computed(() => {
    const s = this.session.state();
    return s.status === 'READY' &&
      s.membership.role === 'HQ' &&
      this.workspace.workspace()?.kind === 'HQ'
      ? JSON.stringify([s.membership.userId, s.membership.businessId])
      : undefined;
  });
  private readonly record = resource({
    params: () => {
      const identity = this.identity();
      return identity
        ? {
            identity,
            offset: this.offset(),
            status: this.status(),
            tick: this.activity.refreshTick(),
          }
        : undefined;
    },
    loader: async ({ params }) => ({
      identity: params.identity,
      page: await this.api.listIssues({ offset: params.offset, limit: 20, status: params.status }),
    }),
  });
  private readonly page = computed(() =>
    this.record.hasValue() && this.record.value().identity === this.identity()
      ? this.record.value().page
      : undefined,
  );
  readonly rows = computed(() => this.page()?.items ?? []);
  readonly openCount = computed(() => this.page()?.openCount ?? 0);
  readonly loading = this.record.isLoading;
  readonly error = computed(() => !!this.record.error());
  readonly hasNext = computed(() => this.page()?.hasMore ?? false);
  refresh() {
    this.record.reload();
  }
  select(value: boolean) {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: value ? 'delivery-issues' : null },
      queryParamsHandling: 'merge',
    });
  }
  filter(status: 'OPEN' | 'ALL') {
    this.go(0, status);
  }
  next() {
    if (this.hasNext() && !this.loading()) this.go(this.offset() + 20);
  }
  previous() {
    if (!this.loading()) this.go(Math.max(0, this.offset() - 20));
  }
  private go(offset: number, status = this.status()) {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: 'delivery-issues', issueOffset: offset, issueStatus: status },
      queryParamsHandling: 'merge',
    });
  }
}
