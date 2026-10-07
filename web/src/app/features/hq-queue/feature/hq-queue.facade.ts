import { Service, inject, computed, resource, signal } from '@angular/core';
import { SessionFacade } from '../../auth/feature/session.facade';
import { BrowserActivity } from '../../../core/browser-activity';
import { ReplenishmentApi } from '../../replenishment/data-access/replenishment-api';
@Service({ autoProvided: false })
export class HqQueueFacade {
  private readonly api = inject(ReplenishmentApi);
  private readonly session = inject(SessionFacade);
  private readonly activity = inject(BrowserActivity);
  readonly offset = signal(0);
  private readonly page = resource({
    params: () => {
      const s = this.session.state();
      return s.status === 'READY' && s.membership.role === 'HQ'
        ? { uid: s.membership.userId, offset: this.offset(), tick: this.activity.refreshTick() }
        : undefined;
    },
    loader: ({ params }) => this.api.listHQQueue({ offset: params.offset, limit: 50 }),
  });
  readonly rows = computed(() => (this.page.hasValue() ? this.page.value().items : []));
  readonly loading = this.page.isLoading;
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
    if (this.hasNext()) this.offset.update((v) => v + 50);
  }
  previous() {
    this.offset.update((v) => Math.max(0, v - 50));
  }
}
