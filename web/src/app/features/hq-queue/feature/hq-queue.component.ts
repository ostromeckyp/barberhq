import { DelayedLoadingDirective } from '../../../shared/ui/delayed-loading/delayed-loading';
import { DeliveryIssuesFacade } from '../../delivery/feature/delivery-issues.facade';
import { DeliveryIssuesList } from '../../delivery/ui/delivery-issues-list';
import { MatIconModule } from '@angular/material/icon';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { RequestList } from '../../replenishment/ui/request-list';
import { HqQueueFacade } from './hq-queue.facade';
@Component({
  selector: 'app-hq-queue',
  providers: [HqQueueFacade, DeliveryIssuesFacade],
  imports: [
    DelayedLoadingDirective,
    MatButtonModule,
    MatProgressBarModule,
    PageHeader,
    RequestList,
    DeliveryIssuesList,
    MatIconModule,
  ],
  template: `
    <app-page-header
      eyebrow="HQ WORKSPACE"
      title="Salon requests"
      description="Review requests. Reserve stock. Keep salons supplied."
      ><button mat-stroked-button (click)="facade.refresh()" [disabled]="facade.loading()">
        Refresh
      </button></app-page-header
    >
    <div class="queue-views" role="group" aria-label="Queue view">
      <button
        mat-stroked-button
        type="button"
        [attr.aria-pressed]="!issues.selected()"
        (click)="issues.select(false)"
      >
        <mat-icon aria-hidden="true">receipt_long</mat-icon>Requests
      </button>
      <button
        mat-stroked-button
        type="button"
        [attr.aria-pressed]="issues.selected()"
        (click)="issues.select(true)"
      >
        <mat-icon aria-hidden="true">report_problem</mat-icon>Delivery issues ({{
          issues.openCount()
        }})
      </button>
    </div>
    @if (issues.selected()) {
      <app-delivery-issues-list />
    } @else {
      <mat-progress-bar
        *appDelayedLoading="facade.loading()"
        mode="indeterminate"
        aria-label="Loading requests"
      />
      @if (facade.error()) {
        <p role="alert">
          Requests unavailable. <button mat-button (click)="facade.refresh()">Retry</button>
        </p>
      }
      <section>
        <h2>
          Pending approval <span>{{ facade.pending().length }}</span>
        </h2>
        <app-request-list
          [context]="{ kind: 'HQ', offset: facade.offset() }"
          [requests]="facade.pending()"
        />
      </section>
      <section>
        <h2>
          Ready to dispatch <span>{{ facade.reserved().length }}</span>
        </h2>
        <app-request-list
          [context]="{ kind: 'HQ', offset: facade.offset() }"
          [requests]="facade.reserved()"
        />
      </section>
      @if (facade.other().length) {
        <section>
          <h2>Dispatched and completed</h2>
          <app-request-list
            [context]="{ kind: 'HQ', offset: facade.offset() }"
            [requests]="facade.other()"
          />
        </section>
      }
      <nav aria-label="Queue pages">
        <button
          mat-button
          (click)="facade.previous()"
          [disabled]="facade.offset() === 0 || facade.loading()"
        >
          Previous</button
        ><button
          mat-button
          (click)="facade.next()"
          [disabled]="!facade.hasNext() || facade.loading()"
        >
          Next
        </button>
      </nav>
    }
  `,
  styles: [
    `
      .queue-views {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 20px;
      }
      .queue-views button {
        --mat-button-outlined-label-text-color: var(--ink);
      }
      .queue-views button[aria-pressed='true'] {
        background: var(--surface-alt, #eee);
      }
      section {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 20px;
        margin: 20px 0;
      }
      h2 {
        font-size: 16px;
        margin: 0;
      }
      h2 span {
        font: 14px var(--font-mono);
        color: var(--muted);
        margin-left: 12px;
      }
      nav {
        display: flex;
        justify-content: flex-end;
      }
    `,
  ],
})
export class HqQueueComponent {
  readonly facade = inject(HqQueueFacade);
  readonly issues = inject(DeliveryIssuesFacade);
}
