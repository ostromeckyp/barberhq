import { MatButtonModule } from '@angular/material/button';
import { Component, input, output } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { LowStockChip } from '../../../../shared/ui/low-stock-chip/low-stock-chip';
import type { InventoryRow } from '../../../../../../../shared/contracts/business';
@Component({
  selector: 'app-stock-table',
  imports: [MatTableModule, LowStockChip, MatButtonModule],
  templateUrl: './stock-table.html',
  styleUrl: './stock-table.scss',
})
export class StockTable {
  readonly rows = input.required<InventoryRow[]>();
  readonly threshold = input.required<number | undefined>();
  readonly updated = input.required<string>();
  readonly requestEnabled = input(false);
  readonly requestProduct = output<string>();
  readonly columns = ['product', 'salon'];
}
