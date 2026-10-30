import { Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import type { RequestState } from '../../../../../../shared/contracts/stock/index';
export const STATUSES: Record<RequestState, { labelKey: string; icon: string }> = {
  PENDING_APPROVAL: { labelKey: 'requests.status.PENDING_APPROVAL', icon: 'hourglass_top' },
  RESERVED: { labelKey: 'requests.status.RESERVED', icon: 'lock' },
  DISPATCHED: { labelKey: 'requests.status.DISPATCHED', icon: 'local_shipping' },
  RECEIVED: { labelKey: 'requests.status.RECEIVED', icon: 'check_circle' },
  RECEIVED_WITH_ISSUE: { labelKey: 'requests.status.RECEIVED_WITH_ISSUE', icon: 'error_outline' },
  REJECTED: { labelKey: 'requests.status.REJECTED', icon: 'cancel' },
};
@Component({
  selector: 'app-status-chip',
  imports: [MatChipsModule, MatIconModule, TranslocoPipe],
  template:
    '<mat-chip [class]="state()"><mat-icon matChipAvatar>{{ display().icon }}</mat-icon>{{ display().labelKey | transloco }}</mat-chip>',
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
      .RECEIVED_WITH_ISSUE {
        --mat-chip-elevated-container-color: #fbefd6;
        --mat-chip-label-text-color: #5c3700;
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
