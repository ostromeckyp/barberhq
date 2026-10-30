import { Service, inject, computed, signal, linkedSignal, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { form, validate, disabled } from '@angular/forms/signals';
import { SalonSettingsApi, SettingsSaveError } from '../data-access/salon-settings-api';
import { SessionFacade } from '../../auth/feature/session.facade';
import { BrowserActivity } from '../../../core/browser-activity';
import type { TranslatedText } from '../../../core/models/translated-text';
import type { SalonSettings } from '../../../../../../shared/contracts/settings/index';
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
  message: TranslatedText | null;
  readEpoch: number;
  value?: number;
}
const saveErrorKey = (code: SettingsSaveError['code']): string =>
  code === 'STALE_STATE'
    ? 'salon.settings.errors.stale'
    : code === 'UNKNOWN'
      ? 'salon.settings.errors.unknown'
      : code === 'FORBIDDEN'
        ? 'salon.settings.errors.forbidden'
        : 'salon.settings.errors.rejected';
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
  private readonly status = linkedSignal({
    source: this.scope,
    computation: (): SaveState => ({ phase: 'IDLE', message: null, readEpoch: 0 }),
  });
  private readonly draftVersion = linkedSignal({
    source: () => ({
      scope: this.scope(),
      snapshot: this.snapshot(),
      resetEpoch: this.resetEpoch(),
      status: this.status(),
    }),
    computation: (s, previous): number | undefined => {
      if (!s.scope) return undefined;
      if (!previous || previous.source.scope !== s.scope) return s.snapshot?.settings.version;
      if (s.snapshot && previous.value === undefined) return s.snapshot.settings.version;
      if (
        s.snapshot?.resetEpoch === s.resetEpoch &&
        previous.source.snapshot?.resetEpoch !== s.resetEpoch
      )
        return s.snapshot.settings.version;
      if (previous.source.resetEpoch !== s.resetEpoch) {
        return s.snapshot?.resetEpoch === s.resetEpoch
          ? s.snapshot.settings.version
          : previous.value;
      }
      const reconciledSave = s.status.phase === 'UNKNOWN' || s.status.phase === 'SAVED';
      if (
        reconciledSave &&
        s.snapshot &&
        s.snapshot.readEpoch > s.status.readEpoch &&
        s.snapshot.settings.lowStockThreshold === s.status.value
      )
        return s.snapshot.settings.version;
      return previous.value;
    },
  });
  readonly model = linkedSignal({
    source: () => ({
      scope: this.scope(),
      snapshot: this.snapshot(),
      draftVersion: this.draftVersion(),
    }),
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
  readonly version = computed(() => this.snapshot()?.settings.version);
  private readonly draftNeedsReview = computed(
    () =>
      this.draftVersion() !== undefined &&
      this.version() !== undefined &&
      this.draftVersion() !== this.version(),
  );
  readonly loading = this.record.isLoading;
  readonly saving = computed(() => this.status().phase === 'SAVING');
  readonly saved = computed(() => this.status().phase === 'SAVED');
  readonly stale = computed(() => this.status().phase === 'STALE' || this.draftNeedsReview());
  readonly error = computed((): TranslatedText | null => {
    if (this.draftNeedsReview())
      return {
        key: 'salon.settings.errors.changed',
        params: { value: this.snapshot()?.settings.lowStockThreshold },
      };
    return (
      this.status().message ??
      (this.record.error()
        ? { key: 'salon.settings.errors.unavailable' }
        : !this.scope()
          ? { key: 'salon.settings.errors.forbidden' }
          : null)
    );
  });
  readonly canSave = computed(
    () =>
      !!this.scope() &&
      this.version() !== undefined &&
      !this.draftNeedsReview() &&
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
        : { kind: 'range', message: 'salon.settings.errors.range' },
    );
    disabled(p, () => this.loading() || this.saving() || this.version() === undefined);
  });
  async save() {
    const scope = this.scope();
    if (!scope || !this.canSave()) return;
    const readEpoch = this.readEpoch();
    const value = this.model().lowStockThreshold;
    this.status.set({
      phase: 'SAVING',
      message: null,
      readEpoch,
      value,
    });
    try {
      await this.api.save({
        salonId: scope.salonId,
        lowStockThreshold: value,
        expectedVersion: this.draftVersion()!,
      });
      if (this.scope() !== scope) return;
      this.status.set({ phase: 'SAVED', message: null, readEpoch, value });
      this.readEpoch.update((v) => v + 1);
    } catch (error) {
      if (this.scope() !== scope) return;
      const code = error instanceof SettingsSaveError ? error.code : 'UNKNOWN';
      this.status.set({
        phase: code === 'STALE_STATE' ? 'STALE' : code === 'UNKNOWN' ? 'UNKNOWN' : 'ERROR',
        message: { key: saveErrorKey(code) },
        readEpoch,
        value,
      });
      if (code === 'UNKNOWN') this.readEpoch.update((v) => v + 1);
    }
  }
  reload() {
    if (this.saving()) return;
    this.status.set({ phase: 'IDLE', message: null, readEpoch: this.readEpoch() });
    this.resetEpoch.update((v) => v + 1);
    this.readEpoch.update((v) => v + 1);
  }
}
