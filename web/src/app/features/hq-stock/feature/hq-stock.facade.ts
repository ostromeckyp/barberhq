import { Service, computed, inject, resource } from '@angular/core';
import { ClientLog } from '../../../core/client-log';
import { SessionFacade } from '../../auth/feature/session.facade';
import { BrowserActivity } from '../../../core/browser-activity';
import { HqStockApi } from '../data-access/hq-stock-api';

@Service({ autoProvided: false })
export class HqStockFacade {
  private readonly session = inject(SessionFacade);
  private readonly log = inject(ClientLog);
  private readonly api = inject(HqStockApi);
  private readonly activity = inject(BrowserActivity);
  private readonly inventory = resource({
    params: () => {
      const state = this.session.state();
      return state.status === 'READY' && state.membership.role === 'HQ'
        ? {
            userId: state.membership.userId,
            businessId: state.membership.businessId,
            tick: this.activity.refreshTick(),
          }
        : undefined;
    },
    loader: ({ abortSignal }) => this.log.step('hq.stock.load', () => this.api.load(abortSignal)),
  });
  readonly rows = computed(() => (this.inventory.hasValue() ? this.inventory.value() : []));
  readonly loading = this.inventory.isLoading;
  readonly error = computed(() => !!this.inventory.error());
  refresh() {
    this.inventory.reload();
  }
}
