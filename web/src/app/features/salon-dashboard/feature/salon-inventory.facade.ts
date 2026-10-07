import { Service, computed, inject, linkedSignal, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { BrowserActivity } from '../../../core/browser-activity';
import { SalonSettingsApi } from '../../salon-settings/data-access/salon-settings-api';
import { SessionFacade } from '../../auth/feature/session.facade';
import { InventoryApi } from '../data-access/inventory-api';
import type { InventoryRow } from '../../../../../../shared/contracts/business';

interface InventoryScope {
  salonId: string;
  userId: string;
  businessId: string;
}
interface InventorySnapshot {
  scope: InventoryScope;
  rows: InventoryRow[];
  updatedAt: Date;
}

/** One instance per salon page. Components consume selectors and issue commands. */
@Service({ autoProvided: false })
export class SalonInventoryFacade {
  private readonly settingsApi = inject(SalonSettingsApi);
  private readonly api = inject(InventoryApi);
  private readonly session = inject(SessionFacade);
  private readonly browser = inject(BrowserActivity);
  private readonly salonId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('salonId'))),
  );
  private readonly scope = computed((): InventoryScope | undefined => {
    const state = this.session.state();
    const salonId = this.salonId();
    return state.status === 'READY' && salonId && this.session.canOpen(salonId)
      ? { salonId, userId: state.membership.userId, businessId: state.membership.businessId }
      : undefined;
  });
  private readonly inventory = resource({
    params: () => {
      const scope = this.scope();
      return scope ? { scope, refreshTick: this.browser.refreshTick() } : undefined;
    },
    loader: async ({ params, abortSignal }): Promise<InventorySnapshot> => ({
      scope: params.scope,
      rows: await this.api.getInventory(params.scope.salonId, abortSignal),
      updatedAt: new Date(),
    }),
  });
  // Keep the last successful snapshot during refresh failures, but never across scopes.
  private readonly snapshot = linkedSignal({
    source: () => ({
      scope: this.scope(),
      value: this.inventory.hasValue() ? this.inventory.value() : undefined,
    }),
    computation: (source, previous): InventorySnapshot | undefined => {
      if (!source.scope) return undefined;
      if (source.value?.scope === source.scope) return source.value;
      return previous?.value?.scope === source.scope ? previous.value : undefined;
    },
  });
  readonly name = computed(
    () => this.session.salons().find((s) => s.id === this.salonId())?.name ?? 'Salon',
  );
  private readonly settings = resource({
    params: () => {
      const scope = this.scope();
      return scope
        ? { scope, revision: this.settingsApi.revision(), tick: this.browser.refreshTick() }
        : undefined;
    },
    loader: async ({ params }) => ({
      scope: params.scope,
      settings: await this.settingsApi.get(params.scope.salonId),
    }),
  });
  readonly threshold = computed(() =>
    this.settings.hasValue() && this.settings.value().scope === this.scope()
      ? this.settings.value().settings.lowStockThreshold
      : undefined,
  );
  readonly settingsUnavailable = computed(
    () => this.threshold() === undefined && !this.settings.isLoading(),
  );
  readonly rows = computed(() => this.snapshot()?.rows ?? []);
  readonly loading = this.inventory.isLoading;
  readonly error = computed(() => this.inventory.error() !== undefined);
  readonly stale = computed(() => !!this.snapshot() && (!this.browser.online() || this.error()));
  readonly updated = computed(
    () =>
      this.snapshot()?.updatedAt.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      }) ?? '',
  );

  refresh() {
    this.inventory.reload();
    this.settings.reload();
  }
}
