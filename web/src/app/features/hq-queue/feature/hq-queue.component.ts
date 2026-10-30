import { DelayedLoadingDirective } from '../../../shared/ui/delayed-loading/delayed-loading';
import { DeliveryIssuesFacade } from '../../delivery/feature/delivery-issues.facade';
import { DeliveryIssuesList } from '../../delivery/ui/delivery-issues-list';
import { MatIconModule } from '@angular/material/icon';
import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
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
    TranslocoPipe,
  ],
  template: `
    <app-page-header
      [eyebrow]="'hq.queue.eyebrow' | transloco"
      [title]="'hq.queue.title' | transloco"
      [description]="'hq.queue.description' | transloco"
      ><button mat-button (click)="facade.refresh()" [disabled]="facade.loading()">
        <mat-icon aria-hidden="true">refresh</mat-icon>{{ 'common.actions.refresh' | transloco }}
      </button></app-page-header
    >
    <div class="queue-views" role="group" [attr.aria-label]="'hq.queue.view' | transloco">
      <button
        mat-stroked-button
        type="button"
        [attr.aria-pressed]="!issues.selected()"
        (click)="issues.select(false)"
      >
        <mat-icon aria-hidden="true">receipt_long</mat-icon>{{ 'hq.queue.requests' | transloco }}
      </button>
      <button
        mat-stroked-button
        type="button"
        [attr.aria-pressed]="issues.selected()"
        (click)="issues.select(true)"
      >
        <mat-icon aria-hidden="true">report_problem</mat-icon
        >{{ 'hq.queue.deliveryIssues' | transloco: { count: issues.openCount() } }}
      </button>
    </div>
    @if (issues.selected()) {
      <app-delivery-issues-list />
    } @else {
      <mat-progress-bar
        *appDelayedLoading="facade.loading()"
        mode="indeterminate"
        [attr.aria-label]="'hq.queue.loading' | transloco"
      />
      @if (facade.error()) {
        <p role="alert">
          {{ 'hq.queue.unavailable' | transloco }}
          <button mat-button (click)="facade.refresh()">
            {{ 'common.actions.retry' | transloco }}
          </button>
        </p>
      }
      <section>
        <h2>
          {{ 'hq.queue.pending' | transloco }} <span>{{ facade.pending().length }}</span>
        </h2>
        <app-request-list
          [context]="{ kind: 'HQ', offset: facade.offset() }"
          [requests]="facade.pending()"
        />
      </section>
      <section>
        <h2>
          {{ 'hq.queue.ready' | transloco }} <span>{{ facade.reserved().length }}</span>
        </h2>
        <app-request-list
          [context]="{ kind: 'HQ', offset: facade.offset() }"
          [requests]="facade.reserved()"
        />
      </section>
      @if (facade.other().length) {
        <section>
          <h2>{{ 'hq.queue.other' | transloco }}</h2>
          <app-request-list
            [context]="{ kind: 'HQ', offset: facade.offset() }"
            [requests]="facade.other()"
          />
        </section>
      }
      <nav [attr.aria-label]="'hq.queue.pages' | transloco">
        <button
          mat-button
          (click)="facade.previous()"
          [disabled]="facade.offset() === 0 || facade.loading()"
        >
          {{ 'common.actions.previous' | transloco }}</button
        ><button
          mat-button
          (click)="facade.next()"
          [disabled]="!facade.hasNext() || facade.loading()"
        >
          {{ 'common.actions.next' | transloco }}
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
