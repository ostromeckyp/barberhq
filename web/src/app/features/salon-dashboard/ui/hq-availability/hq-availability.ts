import { Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import type { InventoryRow } from '../../../../../../../shared/contracts/business/index';
@Component({
  selector: 'app-hq-availability',
  imports: [MatIconModule, MatTableModule, TranslocoPipe],
  templateUrl: './hq-availability.html',
  styleUrl: './hq-availability.scss',
})
export class HqAvailability {
  readonly rows = input.required<InventoryRow[]>();
  readonly columns = ['product', 'quantity'];
}
