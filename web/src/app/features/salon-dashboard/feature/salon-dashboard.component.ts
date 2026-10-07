import { runtimeConfig } from '../../../core/public-config';
import { OrderFacade } from '../../replenishment/feature/order.facade';
import { DraftStore } from '../../replenishment/feature/draft.store';
import { OrderPanel } from '../../replenishment/ui/order-panel';
import { RequestList } from '../../replenishment/ui/request-list';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { StaleBannerComponent } from '../../../shared/ui/stale-banner/stale-banner.component';
import { StockTable } from '../ui/stock-table/stock-table';
import { HqAvailability } from '../ui/hq-availability/hq-availability';
import { SalonInventoryFacade } from './salon-inventory.facade';
@Component({
  selector: 'app-salon-dashboard',
  providers: [SalonInventoryFacade, OrderFacade, DraftStore],
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    PageHeader,
    EmptyStateComponent,
    StaleBannerComponent,
    StockTable,
    OrderPanel,
    RequestList,
    HqAvailability,
  ],
  templateUrl: './salon-dashboard.component.html',
  styleUrl: './salon-dashboard.component.scss',
})
export class SalonDashboardComponent {
  readonly facade = inject(SalonInventoryFacade);
  readonly enabled = runtimeConfig.publicConfig?.replenishmentEnabled ?? false;
  readonly order = this.enabled ? inject(OrderFacade) : undefined;
}
