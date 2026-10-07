import { Service, inject, computed, signal, linkedSignal, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { form, validate, disabled } from '@angular/forms/signals';
import { SalonSettingsApi, SettingsSaveError } from '../data-access/salon-settings-api';
import { SessionFacade } from '../../auth/feature/session.facade';
import { BrowserActivity } from '../../../core/browser-activity';
import type { SalonSettings } from '../../../../../../shared/contracts/settings';
interface SettingsScope {
  salonId: string;
  userId: string;
  businessId: string;
}
interface SettingsSnapshot {
  scope: SettingsScope;
  readEpoch: number;
  resetEpoch: number;
  settings: SalonSettings;
}
interface SaveState {
  phase: 'IDLE' | 'SAVING' | 'SAVED' | 'STALE' | 'UNKNOWN' | 'ERROR';
  message: string;
  readEpoch: number;
}
@Service({ autoProvided: false })
export class SalonSettingsFacade {
  private readonly api = inject(SalonSettingsApi);
  private readonly session = inject(SessionFacade);
  private readonly activity = inject(BrowserActivity);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  private readonly scope = computed(() => {
    const s = this.session.state(),
      salonId = this.params()?.get('salonId');
    return s.status === 'READY' && salonId && s.membership.salonIds.includes(salonId)
      ? { salonId, userId: s.membership.userId, businessId: s.membership.businessId }
      : undefined;
  });
  private readonly readEpoch = signal(0);
  private readonly resetEpoch = signal(0);
  private readonly record = resource({
    params: () => {
      const scope = this.scope();
      return scope
        ? {
            scope,
            readEpoch: this.readEpoch(),
            resetEpoch: this.resetEpoch(),
            revision: this.api.revision(),
            tick: this.activity.refreshTick(),
          }
        : undefined;
    },
    loader: async ({ params }) => ({
      ...params,
      settings: await this.api.get(params.scope.salonId),
    }),
  });
  private readonly snapshot = linkedSignal({
    source: () => ({
      scope: this.scope(),
      record: this.record.hasValue() ? this.record.value() : undefined,
    }),
    computation: (s, previous): SettingsSnapshot | undefined => {
      if (!s.scope) return undefined;
      return s.record?.scope === s.scope
        ? s.record
        : previous?.value?.scope === s.scope
          ? previous.value
          : undefined;
    },
  });
  readonly model = linkedSignal({
    source: () => ({ scope: this.scope(), snapshot: this.snapshot() }),
    computation: (s, previous): { lowStockThreshold: number } => {
      if (!s.scope) return { lowStockThreshold: 0 };
      if (
        previous?.source.scope === s.scope &&
        previous.source.snapshot &&
        previous.source.snapshot.resetEpoch === s.snapshot?.resetEpoch
      )
        return previous.value;
      return { lowStockThreshold: s.snapshot?.settings.lowStockThreshold ?? 0 };
    },
  });
  private readonly status = linkedSignal({
    source: this.scope,
    computation: (): SaveState => ({ phase: 'IDLE', message: '', readEpoch: 0 }),
  });
  readonly version = computed(() => this.snapshot()?.settings.version);
  readonly loading = this.record.isLoading;
  readonly saving = computed(() => this.status().phase === 'SAVING');
  readonly saved = computed(() => this.status().phase === 'SAVED');
  readonly stale = computed(() => this.status().phase === 'STALE');
  readonly error = computed(
    () =>
      this.status().message ||
      (this.record.error()
        ? 'Settings unavailable. Retry or contact HQ.'
        : !this.scope()
          ? 'Access denied.'
          : ''),
  );
  readonly canSave = computed(
    () =>
      !!this.scope() &&
      this.version() !== undefined &&
      !this.loading() &&
      !this.record.error() &&
      !this.saving() &&
      !this.stale() &&
      !(
        this.status().phase === 'UNKNOWN' &&
        (this.snapshot()?.readEpoch ?? -1) <= this.status().readEpoch
      ) &&
      Number.isInteger(this.model().lowStockThreshold) &&
      this.model().lowStockThreshold >= 0 &&
      this.model().lowStockThreshold <= 2147483647,
  );
  readonly fields = form(this.model, (p) => {
    validate(p.lowStockThreshold, ({ value }) =>
      Number.isInteger(value()) && value() >= 0 && value() <= 2147483647
        ? undefined
        : { kind: 'range', message: 'Enter a whole number from 0 to 2147483647.' },
    );
    disabled(p, () => this.loading() || this.saving() || this.version() === undefined);
  });
  async save() {
    const scope = this.scope();
    if (!scope || !this.canSave()) return;
    const readEpoch = this.readEpoch();
    this.status.set({ phase: 'SAVING', message: '', readEpoch });
    try {
      await this.api.save({
        salonId: scope.salonId,
        lowStockThreshold: this.model().lowStockThreshold,
        expectedVersion: this.version()!,
      });
      if (this.scope() !== scope) return;
      this.status.set({ phase: 'SAVED', message: '', readEpoch });
      this.readEpoch.update((v) => v + 1);
    } catch (error) {
      if (this.scope() !== scope) return;
      const code = error instanceof SettingsSaveError ? error.code : 'UNKNOWN';
      this.status.set({
        phase: code === 'STALE_STATE' ? 'STALE' : code === 'UNKNOWN' ? 'UNKNOWN' : 'ERROR',
        message:
          code === 'STALE_STATE'
            ? 'Settings changed elsewhere. Reload and review before saving.'
            : code === 'UNKNOWN'
              ? 'Save not confirmed. Reloading current settings; review before saving again.'
              : code === 'FORBIDDEN'
                ? 'Access denied.'
                : 'Setting was rejected. Review the value.',
        readEpoch,
      });
      if (code === 'UNKNOWN') this.readEpoch.update((v) => v + 1);
    }
  }
  reload() {
    if (this.saving()) return;
    this.status.set({ phase: 'IDLE', message: '', readEpoch: this.readEpoch() });
    this.resetEpoch.update((v) => v + 1);
    this.readEpoch.update((v) => v + 1);
  }
}
