import { DelayedLoadingDirective } from '../../../shared/ui/delayed-loading/delayed-loading';
import {
  Component,
  DestroyRef,
  effect,
  inject,
  TemplateRef,
  viewChild,
  ViewContainerRef,
} from '@angular/core';
import {
  MatBottomSheet,
  MatBottomSheetModule,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ResponsiveLayout } from '../../../core/responsive-layout';
import { SalonContext } from '../../../core/salon-context';
import { runtimeConfig } from '../../../core/public-config';
import { SessionFacade } from '../../auth/feature/session.facade';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { StaleBannerComponent } from '../../../shared/ui/stale-banner/stale-banner.component';
import { DraftStore } from '../../replenishment/feature/draft.store';
import { OrderFacade } from '../../replenishment/feature/order.facade';
import { ReplenishmentAssistantFacade } from '../../replenishment/feature/replenishment-assistant.facade';
import { OrderPanel } from '../../replenishment/ui/order-panel';
import { StockTable } from '../ui/stock-table/stock-table';
import { SalonInventoryFacade } from './salon-inventory.facade';
@Component({
  selector: 'app-salon-dashboard',
  providers: [SalonInventoryFacade, OrderFacade, DraftStore, ReplenishmentAssistantFacade],
  imports: [
    MatButtonModule,
    DelayedLoadingDirective,
    MatIconModule,
    MatProgressBarModule,
    MatBottomSheetModule,
    PageHeader,
    EmptyStateComponent,
    StaleBannerComponent,
    StockTable,
    OrderPanel,
    NgTemplateOutlet,
    RouterLink,
    TranslocoPipe,
  ],
  templateUrl: './salon-dashboard.component.html',
  styleUrl: './salon-dashboard.component.scss',
})
export class SalonDashboardComponent {
  readonly context = inject(SalonContext);
  readonly facade = inject(SalonInventoryFacade);
  readonly enabled = runtimeConfig.publicConfig?.replenishmentEnabled ?? false;
  readonly order = this.enabled ? inject(OrderFacade) : undefined;
  private readonly session = inject(SessionFacade);
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly transloco = inject(TranslocoService);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly requestSheet = viewChild<TemplateRef<unknown>>('requestSheet');
  readonly mobile = inject(ResponsiveLayout).compact;
  private sheetRef?: MatBottomSheetRef<unknown>;
  private contextKey: string | undefined;

  constructor() {
    effect(() => {
      const session = this.session.state();
      const identity =
        session.status === 'READY'
          ? `${session.membership.userId}:${session.membership.businessId}`
          : session.status;
      const key = `${this.context.selectedWorkspace() ?? ''}:${this.order?.salonId() ?? ''}:${identity}:${!!this.order?.canOrder()}`;
      if (this.contextKey !== undefined && this.contextKey !== key) this.closeRequestSheet();
      this.contextKey = key;

      if (!this.mobile()) this.closeRequestSheet();
    });
    this.destroyRef.onDestroy(() => this.closeRequestSheet());
  }

  requestProduct(productId: string) {
    this.order?.select(productId);
    if (this.mobile()) this.openRequestSheet();
  }

  openRequestSheet() {
    const template = this.requestSheet();
    if (!template || !this.mobile() || !this.order?.canOrder() || this.sheetRef) return;
    this.sheetRef = this.bottomSheet.open(template, {
      viewContainerRef: this.viewContainerRef,
      ariaLabel: this.transloco.translate('salon.dashboard.requestProducts'),
      panelClass: 'request-products-sheet',
      autoFocus: 'dialog',
      closeOnNavigation: true,
      maxHeight: '90dvh',
    });
    this.sheetRef.afterDismissed().subscribe(() => (this.sheetRef = undefined));
  }

  closeRequestSheet() {
    this.sheetRef?.dismiss();
  }
}
