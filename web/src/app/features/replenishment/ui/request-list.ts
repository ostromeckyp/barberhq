import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import type { RequestSummary } from '../../../../../../shared/contracts/stock';
import type { RequestListContext } from '../../../core/request-navigation';
import { StatusChip } from './status-chip';

@Component({
  selector: 'app-request-list',
  imports: [RouterLink, DatePipe, MatButtonModule, MatTableModule, StatusChip],
  template: `
    @if (requests().length) {
      <div class="table-scroll" role="region" aria-label="Requests" tabindex="0">
        <table mat-table [dataSource]="requests()" aria-label="Requests">
          <ng-container matColumnDef="request">
            <th mat-header-cell *matHeaderCellDef>Request</th>
            <td mat-cell *matCellDef="let request">
              <strong>Request {{ request.id.slice(0, 8) }} · {{ request.itemCount }} items</strong>
              <small class="items">
                @for (item of request.items; track item.productId) {
                  {{ item.productName }} × {{ item.quantity }}{{ $last ? '' : ' · ' }}
                }
              </small>
              <small class="muted"
                >{{ request.salonName }} · {{ request.createdAt | date: 'd MMM, HH:mm' }}</small
              >
            </td>
          </ng-container>

          <ng-container matColumnDef="quantity">
            <th mat-header-cell *matHeaderCellDef class="quantity-cell">Quantity</th>
            <td mat-cell *matCellDef="let request" class="quantity-cell">
              <span class="quantity">{{ request.totalUnits }}</span
              ><small>pcs</small>
            </td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let request"><app-status-chip [state]="request.state" /></td>
          </ng-container>

          <ng-container matColumnDef="action">
            <th mat-header-cell *matHeaderCellDef>Action</th>
            <td mat-cell *matCellDef="let request">
              <a
                mat-stroked-button
                [routerLink]="
                  context()?.kind === 'HQ'
                    ? ['/hq', 'requests', request.id]
                    : ['/salons', request.salonId, 'requests', request.id]
                "
                [state]="{ listContext: context() }"
                >Open request</a
              >
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns" class="request-row"></tr>
        </table>
      </div>
    } @else {
      <p class="empty">No requests in this section.</p>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .table-scroll {
        max-width: 100%;
        overflow-x: auto;
        overscroll-behavior-inline: contain;
        border-radius: 8px;
      }
      .table-scroll:focus-visible {
        outline: 2px solid var(--brand);
        outline-offset: 2px;
      }
      table {
        width: 100%;
        min-width: 760px;
        table-layout: fixed;
        background: var(--surface);
      }
      .mat-column-request {
        width: 42%;
      }
      .mat-column-quantity {
        width: 13%;
      }
      .mat-column-status {
        width: 27%;
      }
      .mat-column-action {
        width: 18%;
      }
      .mat-mdc-header-cell {
        background: var(--table-header);
        color: var(--muted);
        font-size: 12px;
        font-weight: 600;
      }
      td,
      th {
        padding: 10px 16px;
        border-bottom-color: var(--divider);
        vertical-align: middle;
      }
      tr:last-child td {
        border-bottom: 0;
      }
      strong,
      small {
        display: block;
      }
      strong {
        font-weight: 600;
      }
      small,
      .empty {
        color: var(--muted);
      }
      .items {
        overflow-wrap: anywhere;
      }
      .muted {
        margin-top: 4px;
      }
      .quantity-cell {
        text-align: right;
        white-space: nowrap;
      }
      .quantity {
        font: 20px var(--font-mono);
      }
      .quantity-cell small {
        display: inline;
        margin-left: 4px;
        font: 12px var(--font-mono);
      }
      .empty {
        margin: 0;
        padding: 18px 0;
      }
      @media (max-width: 500px) {
        td,
        th {
          padding: 10px 12px;
        }
      }
    `,
  ],
})
export class RequestList {
  readonly context = input<RequestListContext>();
  readonly requests = input.required<RequestSummary[]>();
  readonly columns = ['request', 'quantity', 'status', 'action'];
}
