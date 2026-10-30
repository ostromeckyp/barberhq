import { MatButtonModule } from '@angular/material/button';
import { Component, inject, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { pluralKey } from '../../../../core/i18n/plural';
import { Language } from '../../../../core/language';
import { MatTableModule } from '@angular/material/table';
import { ResponsiveLayout } from '../../../../core/responsive-layout';
import { LowStockChip } from '../../../../shared/ui/low-stock-chip/low-stock-chip';
import type { InventoryRow } from '../../../../../../../shared/contracts/business/index';
@Component({
  selector: 'app-stock-table',
  imports: [MatTableModule, LowStockChip, MatButtonModule, TranslocoPipe],
  templateUrl: './stock-table.html',
  styleUrl: './stock-table.scss',
})
export class StockTable {
  readonly responsiveLayout = inject(ResponsiveLayout);
  private readonly language = inject(Language);
  readonly rows = input.required<InventoryRow[]>();
  readonly threshold = input.required<number | undefined>();
  readonly updated = input.required<string>();
  readonly requestEnabled = input(false);
  readonly requestProduct = output<string>();
  readonly columns = ['product', 'quantity', 'hqAvailable', 'status', 'action'];
  productsKey(count: number): string {
    return pluralKey('requests.count.products', count, this.language.current());
  }
}
