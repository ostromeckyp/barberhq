import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DelayedLoadingDirective } from '../../../shared/ui/delayed-loading/delayed-loading';
import { SalonShorthandFacade } from '../feature/salon-shorthand.facade';

/** Learned phrase → product list; removal is offered only to this salon's staff. */
@Component({
  selector: 'app-salon-shorthand',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    DelayedLoadingDirective,
    TranslocoPipe,
  ],
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
      [attr.aria-label]="'common.shorthand.loading' | transloco"
    />
    @if (facade.error(); as error) {
      <p role="alert">
        {{ error.key | transloco: error.params }}
        <button mat-button (click)="facade.reload()" [disabled]="facade.loading()">
          {{ 'salon.shorthand.reload' | transloco }}
        </button>
      </p>
    }
    @if (facade.empty()) {
      <p>{{ 'salon.shorthand.empty' | transloco }}</p>
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
              [attr.aria-label]="'salon.shorthand.remove' | transloco: { phrase: row.phrase }"
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
        {{ 'common.actions.showMore' | transloco }}
      </button>
    }
  `,
})
export class SalonShorthandComponent {
  readonly facade = inject(SalonShorthandFacade);
}
