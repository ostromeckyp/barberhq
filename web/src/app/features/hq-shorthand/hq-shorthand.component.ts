import { Component, PendingTasks, computed, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import type { SalonShorthand } from '../../../../../shared/contracts/product-lookup/index';
import { DelayedLoadingDirective } from '../../shared/ui/delayed-loading/delayed-loading';
import { PageHeader } from '../../shared/ui/page-header/page-header';
import { SessionFacade } from '../auth/feature/session.facade';
import { SalonShorthandApi } from '../salon-settings/data-access/salon-shorthand-api';

/** HQ sees every salon's learned shorthand read-only; only salon staff remove it. */
@Component({
  selector: 'app-hq-shorthand',
  imports: [MatButtonModule, MatProgressBarModule, DelayedLoadingDirective, PageHeader],
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
      display: grid;
      gap: 2px;
      min-width: 0;
      padding: 8px 0;
      border-bottom: 1px solid var(--line, rgba(0, 0, 0, 0.12));
      overflow-wrap: anywhere;
    }
    .salon {
      font-size: 0.875rem;
      opacity: 0.75;
    }
    .phrase {
      font-weight: 600;
    }
  `,
  template: `
    <app-page-header
      eyebrow="HQ WORKSPACE"
      title="Salon shorthand"
      description="Phrases each salon taught the ordering assistant. Read-only; salon staff remove them in their Settings."
    />
    <mat-progress-bar
      *appDelayedLoading="loading()"
      mode="indeterminate"
      aria-label="Loading salon shorthand"
    />
    @if (error()) {
      <p role="alert">{{ error() }} <button mat-button (click)="load()">Reload</button></p>
    }
    @if (loaded() && !error() && !rows().length) {
      <p>No salon has learned shorthand yet.</p>
    }
    <ul>
      @for (row of rows(); track row.id) {
        <li>
          <span class="salon">{{ row.salonName }}</span>
          <span
            ><span class="phrase">{{ row.phrase }}</span> → {{ row.productName }}</span
          >
        </li>
      }
    </ul>
    @if (next() !== null) {
      <button mat-button class="load-more" (click)="load(next()!)" [disabled]="loading()">
        Show more
      </button>
    }
  `,
})
export class HqShorthandComponent {
  private readonly api = inject(SalonShorthandApi);
  private readonly session = inject(SessionFacade);
  private readonly tasks = inject(PendingTasks);
  private readonly businessId = computed(() => {
    const s = this.session.state();
    return s.status === 'READY' && s.membership.role === 'HQ' ? s.membership.businessId : null;
  });
  private generation = 0;
  readonly rows = signal<SalonShorthand[]>([]);
  readonly next = signal<string | null>(null);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal('');
  constructor() {
    effect(() => {
      this.businessId();
      this.rows.set([]);
      this.next.set(null);
      this.loaded.set(false);
      void this.load();
    });
  }
  async load(after = ''): Promise<void> {
    const businessId = this.businessId();
    const generation = ++this.generation;
    if (!businessId) return;
    const task = this.tasks.add();
    this.loading.set(true);
    this.error.set('');
    try {
      const page = await this.api.listHq(businessId, after);
      if (generation !== this.generation) return;
      this.rows.update((rows) => (after ? [...rows, ...page.rows] : page.rows));
      this.next.set(page.nextCursor);
      this.loaded.set(true);
    } catch {
      if (generation === this.generation) this.error.set('Salon shorthand could not be loaded.');
    } finally {
      if (generation === this.generation) this.loading.set(false);
      task();
    }
  }
}
