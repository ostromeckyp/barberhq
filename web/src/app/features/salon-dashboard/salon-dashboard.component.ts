import {
  Component,
  inject,
  signal,
  input,
  effect,
  untracked,
  DestroyRef,
  computed,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { StockApi } from '../../core/stock-api';
import { SessionService } from '../../core/session.service';
import { runtimeConfig } from '../../core/public-config';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { StaleBannerComponent } from '../../shared/stale-banner.component';
import type { InventoryRow } from '../../../../../shared/contracts/business';
@Component({
  selector: 'app-salon-dashboard',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressBarModule,
    MatTableModule,
    EmptyStateComponent,
    StaleBannerComponent,
  ],
  template: `
    <header class="page-heading">
      <div>
        <p class="eyebrow">SALON INVENTORY</p>
        <h1>{{ name() }}</h1>
        <p class="muted">What’s on your shelf. What’s available at HQ.</p>
      </div>
      <button mat-stroked-button (click)="refresh()" [disabled]="loading()">
        <mat-icon>refresh</mat-icon>Refresh
      </button>
    </header>
    @if (stale()) {
      <app-stale-banner
        message="These are the last loaded quantities. Refresh before making a decision."
        ><button mat-button (click)="refresh()">Retry</button></app-stale-banner
      >
    }
    @if (loading()) {
      <mat-progress-bar mode="indeterminate" aria-label="Loading inventory" />
    }
    @if (error() && !rows().length) {
      <app-empty-state
        title="Inventory is unavailable"
        message="We couldn’t load your quantities. Try again when you’re connected."
        icon="error"
        ><button mat-flat-button (click)="refresh()">Retry</button></app-empty-state
      >
    } @else if (!loading() && !rows().length) {
      <app-empty-state
        title="No stock records yet"
        message="Ask HQ to set up inventory for this salon. Missing stock is not zero stock."
      />
    } @else if (rows().length) {
      <section class="inventory-card" aria-labelledby="stock-heading">
        <div class="card-heading">
          <h2 id="stock-heading">
            Your stock <span class="muted">{{ rows().length }} products</span>
          </h2>
          <span class="demo-label">Synthetic quantities</span>
        </div>
        <table mat-table [dataSource]="rows()">
          <ng-container matColumnDef="product"
            ><th mat-header-cell *matHeaderCellDef>Product</th>
            <td mat-cell *matCellDef="let row">
              <strong>{{ row.productName }}</strong
              ><small>{{ row.netContent.value }} ml</small>
              @if (row.salonOnHand <= threshold) {
                <span class="low-stock"><mat-icon>warning</mat-icon>Low stock</span>
              }
            </td></ng-container
          >
          <ng-container matColumnDef="salon"
            ><th mat-header-cell *matHeaderCellDef>In salon</th>
            <td mat-cell *matCellDef="let row">
              <span class="quantity" [attr.data-testid]="'stock-' + row.demoId">{{
                row.salonOnHand
              }}</span
              ><small>units</small>
            </td></ng-container
          >
          <ng-container matColumnDef="hq"
            ><th mat-header-cell *matHeaderCellDef>HQ available</th>
            <td mat-cell *matCellDef="let row">
              <span class="quantity">{{ row.hqAvailable }}</span
              ><small>units</small>
            </td></ng-container
          >
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr
            mat-row
            *matRowDef="let row; columns: columns"
            [class.low]="row.salonOnHand <= threshold"
          ></tr>
        </table>
        <footer class="stock-footer">
          <mat-icon>info</mat-icon>HQ available excludes reserved units. Refreshed {{ updated() }}.
        </footer>
      </section>
    }
  `,
  styles: `
    .inventory-card {
      background: white;
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
    }
    .card-heading {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px 20px;
      gap: 12px;
      flex-wrap: wrap;
    }
    h2 {
      font-size: 16px;
      margin: 0;
    }
    h2 span {
      font-size: 12px;
      font-weight: 400;
      margin-left: 8px;
    }
    table {
      width: 100%;
      table-layout: fixed;
      background: white;
    }
    .mat-column-product {
      width: 56%;
    }
    .mat-column-salon,
    .mat-column-hq {
      width: 22%;
    }
    th {
      background: #faf9f7 !important;
      color: var(--muted);
      font-size: 12px;
    }
    td {
      padding-top: 16px;
      padding-bottom: 16px;
    }
    td strong {
      font-size: 14px;
      display: block;
      overflow-wrap: anywhere;
    }
    small {
      display: block;
      color: var(--muted);
      font-size: 12px;
      margin-top: 4px;
    }
    .quantity {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 24px;
      font-weight: 500;
    }
    .low {
      background: #fffbf3;
    }
    .low-stock {
      display: inline-flex;
      gap: 4px;
      align-items: center;
      margin-top: 8px;
      padding: 3px 7px;
      border-radius: 5px;
      background: #fbefd6;
      color: #5c3700;
      font-size: 12px;
    }
    .low-stock mat-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
    }
    .stock-footer {
      display: flex;
      gap: 8px;
      padding: 16px 20px;
      color: var(--muted);
      font-size: 12px;
      align-items: center;
    }
    .stock-footer mat-icon {
      flex-shrink: 0;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    @media (max-width: 500px) {
      .card-heading {
        padding: 16px;
      }
      td,
      th {
        padding-left: 10px;
        padding-right: 6px;
      }
      .mat-column-product {
        width: 50%;
      }
      .mat-column-salon,
      .mat-column-hq {
        width: 25%;
      }
      .quantity {
        font-size: 22px;
      }
    }
  `,
})
export class SalonDashboardComponent {
  readonly salonId = input.required<string>();
  private readonly api = inject(StockApi);
  private readonly session = inject(SessionService);
  readonly name = computed(
    () => this.session.salons().find((s) => s.id === this.salonId())?.name ?? 'Salon',
  );
  readonly threshold = runtimeConfig.publicConfig?.lowStockThreshold ?? 2;
  readonly columns = ['product', 'salon', 'hq'];
  readonly rows = signal<InventoryRow[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly stale = signal(false);
  readonly updated = signal('');
  private generation = 0;
  constructor() {
    effect(() => {
      const state = this.session.state();
      const id = this.salonId();
      untracked(() => {
        ++this.generation;
        this.rows.set([]);
        this.stale.set(false);
        if (state.status === 'READY' && this.session.canOpen(id)) void this.refresh();
      });
    });
    const refresh = () => void this.refresh(),
      offline = () => this.stale.set(this.rows().length > 0);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('offline', offline);
    inject(DestroyRef).onDestroy(() => {
      ++this.generation;
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', offline);
    });
  }
  async refresh() {
    if (this.session.state().status !== 'READY' || !this.session.canOpen(this.salonId())) return;
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set(false);
    try {
      const rows = await this.api.getInventory(this.salonId());
      if (generation !== this.generation) return;
      this.rows.set(rows);
      this.stale.set(false);
      this.updated.set(
        new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      );
    } catch {
      if (generation === this.generation) {
        this.error.set(true);
        this.stale.set(this.rows().length > 0);
      }
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
}
