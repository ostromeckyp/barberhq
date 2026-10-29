import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DelayedLoadingDirective } from '../../../shared/ui/delayed-loading/delayed-loading';
import { SalonShorthandFacade } from '../feature/salon-shorthand.facade';

/** Learned phrase → product list; removal is offered only to this salon's staff. */
@Component({
  selector: 'app-salon-shorthand',
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule, DelayedLoadingDirective],
  styles: `
    :host {
      display: block;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    li {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      padding: 8px 0;
      border-bottom: 1px solid var(--line, rgba(0, 0, 0, 0.12));
    }
    .mapping {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .phrase {
      font-weight: 600;
    }
  `,
  template: `
    <mat-progress-bar
      *appDelayedLoading="facade.loading()"
      mode="indeterminate"
      aria-label="Loading salon shorthand"
    />
    @if (facade.error()) {
      <p role="alert">
        {{ facade.error() }}
        <button mat-button (click)="facade.reload()" [disabled]="facade.loading()">
          Reload shorthand
        </button>
      </p>
    }
    @if (facade.empty()) {
      <p>No salon shorthand yet. It appears after staff choose a product for unfamiliar wording.</p>
    }
    <ul>
      @for (row of facade.rows(); track row.id) {
        <li>
          <span class="mapping"
            ><span class="phrase">{{ row.phrase }}</span> → {{ row.productName }}</span
          >
          @if (facade.canRemove()) {
            <button
              mat-icon-button
              [attr.aria-label]="'Remove shorthand ' + row.phrase"
              [disabled]="facade.removing() !== null"
              (click)="facade.remove(row)"
            >
              <mat-icon aria-hidden="true">delete</mat-icon>
            </button>
          }
        </li>
      }
    </ul>
    @if (facade.hasMore()) {
      <button mat-button (click)="facade.loadMore()" [disabled]="facade.loading()">
        Show more
      </button>
    }
  `,
})
export class SalonShorthandComponent {
  readonly facade = inject(SalonShorthandFacade);
}
