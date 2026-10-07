import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { RequestList } from '../../replenishment/ui/request-list';
import { HqQueueFacade } from './hq-queue.facade';
@Component({
  selector: 'app-hq-queue',
  providers: [HqQueueFacade],
  imports: [MatButtonModule, MatProgressBarModule, PageHeader, RequestList],
  template: `
    <app-page-header
      eyebrow="HQ WORKSPACE"
      title="Request queue"
      description="Review requests. Reserve stock. Keep salons supplied."
      ><button mat-stroked-button (click)="facade.refresh()" [disabled]="facade.loading()">
        Refresh
      </button></app-page-header
    >
    @if (facade.loading()) {
      <mat-progress-bar mode="indeterminate" aria-label="Loading requests" />
    }
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
  `,
  styles: [
    `
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
}
