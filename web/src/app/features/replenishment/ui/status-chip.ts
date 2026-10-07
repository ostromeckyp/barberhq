import { Component, computed, input } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import type { RequestState } from '../../../../../../shared/contracts/stock';
export const STATUSES: Record<RequestState, { label: string; icon: string }> = {
  PENDING_APPROVAL: { label: 'Pending approval', icon: 'hourglass_top' },
  RESERVED: { label: 'Approved · reserved', icon: 'lock' },
  DISPATCHED: { label: 'Dispatched', icon: 'local_shipping' },
  RECEIVED: { label: 'Received', icon: 'check_circle' },
  REJECTED: { label: 'Rejected', icon: 'cancel' },
};
@Component({
  selector: 'app-status-chip',
  imports: [MatChipsModule, MatIconModule],
  template:
    '<mat-chip [class]="state()"><mat-icon matChipAvatar>{{ display().icon }}</mat-icon>{{ display().label }}</mat-chip>',
  styles: [
    `
      mat-chip {
        --mat-chip-label-text-color: #171614;
        --mat-chip-elevated-container-color: #e3ded4;
      }
      .PENDING_APPROVAL {
        --mat-chip-elevated-container-color: #fbefd6;
        --mat-chip-label-text-color: #5c3700;
      }
      .RESERVED {
        --mat-chip-elevated-container-color: #dfe6f5;
        --mat-chip-label-text-color: #1f3a6b;
      }
      .RECEIVED {
        --mat-chip-elevated-container-color: #dcebdc;
        --mat-chip-label-text-color: #1f4d23;
      }
      .REJECTED {
        --mat-chip-elevated-container-color: #f9dedc;
        --mat-chip-label-text-color: #8c1d18;
      }
      mat-icon {
        color: inherit;
      }
    `,
  ],
})
export class StatusChip {
  readonly state = input.required<RequestState>();
  readonly display = computed(() => STATUSES[this.state()]);
}
