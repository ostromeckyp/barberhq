import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DelayedLoadingDirective } from '../../../shared/ui/delayed-loading/delayed-loading';
import { DeliveryIssuesFacade } from '../feature/delivery-issues.facade';
import { DeliveryProcedureSettings } from './delivery-procedure-settings';
@Component({
  selector: 'app-delivery-issues-list',
  imports: [RouterLink, DatePipe, MatButtonModule, MatProgressBarModule, DelayedLoadingDirective],
  template: `
    <div class="tools">
      <h2>Delivery issues</h2>
      <button mat-stroked-button type="button" (click)="configure()">Configure procedures</button
      ><button mat-button type="button" (click)="facade.refresh()" [disabled]="facade.loading()">
        Refresh issues
      </button>
    </div>
    <div class="filters" role="group" aria-label="Delivery issue status">
      <button
        mat-button
        type="button"
        [attr.aria-pressed]="facade.status() === 'OPEN'"
        (click)="facade.filter('OPEN')"
      >
        Open issues</button
      ><button
        mat-button
        type="button"
        [attr.aria-pressed]="facade.status() === 'ALL'"
        (click)="facade.filter('ALL')"
      >
        All issues
      </button>
    </div>
    <mat-progress-bar
      *appDelayedLoading="facade.loading()"
      mode="indeterminate"
      aria-label="Loading delivery issues"
    />
    @if (facade.error()) {
      <p role="alert">
        Delivery issues unavailable.
        <button mat-button type="button" (click)="facade.refresh()">Retry</button>
      </p>
    }
    @if (!facade.loading() && !facade.error() && !facade.rows().length) {
      <p>No delivery issues in this view.</p>
    }
    @if (facade.rows().length) {
      <div class="card">
        @for (issue of facade.rows(); track issue.id) {
          <article>
            <div>
              <h3>{{ issue.salonName }}</h3>
              <p>{{ issue.outstandingQuantity }} units remaining · {{ labels[issue.status] }}</p>
              <p>{{ issue.createdAt | date: 'd MMM, HH:mm' }}</p>
            </div>
            <a
              mat-button
              [routerLink]="['/hq', 'delivery-issues', issue.id]"
              [queryParams]="{ issueStatus: facade.status(), issueOffset: facade.offset() }"
              [attr.aria-label]="'Open delivery issue · ' + issue.salonName"
              >Open issue</a
            >
          </article>
        }
      </div>
    }
    <nav aria-label="Delivery issue pages">
      <button
        mat-button
        type="button"
        (click)="facade.previous()"
        [disabled]="facade.offset() === 0 || facade.loading()"
      >
        Previous issues</button
      ><button
        mat-button
        type="button"
        (click)="facade.next()"
        [disabled]="!facade.hasNext() || facade.loading()"
      >
        Next issues
      </button>
    </nav>
  `,
  styles: `
    :host {
      --mat-button-text-label-text-color: var(--ink);
      --mat-button-outlined-label-text-color: var(--ink);
      display: block;
      margin-top: 24px;
    }
    .tools,
    .filters,
    article,
    nav {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    h2 {
      margin-right: auto;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      overflow: hidden;
    }
    article {
      padding: 16px 20px;
      border-bottom: 1px solid var(--divider);
      justify-content: space-between;
    }
    article:last-child {
      border-bottom: 0;
    }
    article div {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    h3 {
      margin: 0;
      font-size: 16px;
    }
    p {
      margin: 8px 0;
    }
    nav {
      justify-content: flex-end;
      margin-top: 16px;
    }
    button[aria-pressed='true'] {
      background: var(--surface-alt, #eee);
    }
    button,
    a {
      max-width: 100%;
    }
  `,
})
export class DeliveryIssuesList {
  readonly facade = inject(DeliveryIssuesFacade);
  private readonly dialog = inject(MatDialog);
  readonly labels = {
    OPEN: 'Open',
    IN_REVIEW: 'Under review',
    REPLACEMENT_IN_PROGRESS: 'Replacement in progress',
    RESOLVED: 'Resolved',
  };
  configure() {
    this.dialog.open(DeliveryProcedureSettings, { width: '640px', maxWidth: 'calc(100vw - 24px)' });
  }
}
