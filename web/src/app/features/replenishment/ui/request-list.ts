import type { RequestListContext } from '../../../core/request-navigation';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { StatusChip } from './status-chip';
import type { RequestSummary } from '../../../../../../shared/contracts/stock';
@Component({
  selector: 'app-request-list',
  imports: [RouterLink, DatePipe, MatButtonModule, StatusChip],
  template: `
    @for (request of requests(); track request.id) {
      <article class="request-row">
        <div class="description">
          <strong>Request {{ request.id.slice(0, 8) }} · {{ request.itemCount }} items</strong
          ><small>
            @for (item of request.items; track item.productId) {
              {{ item.productName }} × {{ item.quantity }}{{ $last ? '' : ' · ' }}
            }</small
          ><small>{{ request.salonName }} · {{ request.createdAt | date: 'd MMM, HH:mm' }}</small>
        </div>
        <span class="quantity">{{ request.totalUnits }} <small>pcs</small></span
        ><app-status-chip [state]="request.state" /><a
          mat-stroked-button
          [routerLink]="['/requests', request.id]"
          [state]="{ listContext: context() }"
          >Open request</a
        >
      </article>
    } @empty {
      <p class="empty">No requests in this section.</p>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .request-row {
        display: flex;
        gap: 16px;
        align-items: center;
        flex-wrap: wrap;
        padding: 18px 0;
        border-bottom: 1px solid var(--divider);
      }
      .description {
        flex: 1 1 200px;
        min-width: 0;
        overflow-wrap: anywhere;
      }
      strong,
      small {
        display: block;
      }
      .description small,
      .empty {
        color: var(--muted);
      }
      .quantity {
        font: 22px var(--font-mono);
      }
      .quantity small {
        display: inline;
        font: 12px var(--font-mono);
      }
      a {
        flex-shrink: 0;
      }
    `,
  ],
})
export class RequestList {
  readonly context = input<RequestListContext>();
  readonly requests = input.required<RequestSummary[]>();
}
