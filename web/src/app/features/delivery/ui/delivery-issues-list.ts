import { MatIconModule } from '@angular/material/icon';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { pluralKey } from '../../../core/i18n/plural';
import { Language } from '../../../core/language';
import { AppDatePipe } from '../../../shared/ui/app-date.pipe';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DelayedLoadingDirective } from '../../../shared/ui/delayed-loading/delayed-loading';
import { DeliveryIssuesFacade } from '../feature/delivery-issues.facade';
import { ISSUE_STATUS_KEYS } from '../feature/issue-status-keys';
import { DeliveryProcedureSettings } from './delivery-procedure-settings';
@Component({
  selector: 'app-delivery-issues-list',
  imports: [
    RouterLink,
    AppDatePipe,
    TranslocoPipe,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    DelayedLoadingDirective,
  ],
  template: `
    <div class="tools">
      <h2>{{ 'delivery.issues.title' | transloco }}</h2>
      <button mat-stroked-button type="button" (click)="configure()">
        {{ 'delivery.issues.configure' | transloco }}</button
      ><button mat-button type="button" (click)="facade.refresh()" [disabled]="facade.loading()">
        <mat-icon aria-hidden="true">refresh</mat-icon>{{ 'delivery.issues.refresh' | transloco }}
      </button>
    </div>
    <div
      class="filters"
      role="group"
      [attr.aria-label]="'delivery.issues.statusFilter' | transloco"
    >
      <button
        mat-button
        type="button"
        [attr.aria-pressed]="facade.status() === 'OPEN'"
        (click)="facade.filter('OPEN')"
      >
        {{ 'delivery.issues.filter.open' | transloco }}</button
      ><button
        mat-button
        type="button"
        [attr.aria-pressed]="facade.status() === 'ALL'"
        (click)="facade.filter('ALL')"
      >
        {{ 'delivery.issues.filter.all' | transloco }}
      </button>
    </div>
    <mat-progress-bar
      *appDelayedLoading="facade.loading()"
      mode="indeterminate"
      [attr.aria-label]="'delivery.issues.loading' | transloco"
    />
    @if (facade.error()) {
      <p role="alert">
        {{ 'delivery.issues.unavailable' | transloco }}
        <button mat-button type="button" (click)="facade.refresh()">
          {{ 'common.actions.retry' | transloco }}
        </button>
      </p>
    }
    @if (!facade.loading() && !facade.error() && !facade.rows().length) {
      <p>{{ 'delivery.issues.empty' | transloco }}</p>
    }
    @if (facade.rows().length) {
      <div class="card">
        @for (issue of facade.rows(); track issue.id) {
          <article>
            <div>
              <h3>{{ issue.salonName }}</h3>
              <p>
                {{
                  remainingKey(issue.outstandingQuantity)
                    | transloco: { count: issue.outstandingQuantity }
                }}
                · {{ labels[issue.status] | transloco }}
              </p>
              <p>{{ issue.createdAt | appDate: 'd MMM, HH:mm' }}</p>
            </div>
            <a
              mat-button
              [routerLink]="['/hq', 'delivery-issues', issue.id]"
              [queryParams]="{ issueStatus: facade.status(), issueOffset: facade.offset() }"
              [attr.aria-label]="
                'delivery.issues.openLabel' | transloco: { salon: issue.salonName }
              "
              >{{ 'delivery.issues.open' | transloco }}</a
            >
          </article>
        }
      </div>
    }
    @if (facade.offset() > 0 || facade.hasNext()) {
      <nav [attr.aria-label]="'delivery.issues.pages' | transloco">
        <button
          mat-button
          type="button"
          (click)="facade.previous()"
          [disabled]="facade.offset() === 0 || facade.loading()"
        >
          {{ 'common.actions.previous' | transloco }}</button
        ><button
          mat-button
          type="button"
          (click)="facade.next()"
          [disabled]="!facade.hasNext() || facade.loading()"
        >
          {{ 'common.actions.next' | transloco }}
        </button>
      </nav>
    }
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
  private readonly language = inject(Language);
  readonly labels = ISSUE_STATUS_KEYS;
  remainingKey(count: number): string {
    return pluralKey('delivery.count.remaining', count, this.language.current());
  }
  configure() {
    this.dialog.open(DeliveryProcedureSettings, { width: '640px', maxWidth: 'calc(100vw - 24px)' });
  }
}
