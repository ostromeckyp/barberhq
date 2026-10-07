import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { InventoryRow } from '../../../../../../../shared/contracts/business';
@Component({
  selector: 'app-hq-availability',
  imports: [MatIconModule],
  templateUrl: './hq-availability.html',
  styleUrl: './hq-availability.scss',
})
export class HqAvailability {
  readonly rows = input.required<InventoryRow[]>();
}
