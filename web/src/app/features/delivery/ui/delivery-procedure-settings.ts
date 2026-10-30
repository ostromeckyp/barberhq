import { Component, computed, effect, inject, resource, signal, untracked } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DelayedLoadingDirective } from '../../../shared/ui/delayed-loading/delayed-loading';
import { SessionFacade } from '../../auth/feature/session.facade';
import { DeliveryApi } from '../data-access/delivery-api';
import { PROCEDURE_KIND_KEYS } from '../feature/procedure-kind-keys';
import { DELIVERY_JOURNAL } from '../feature/delivery-journal';
import type { TranslatedText } from '../../../core/models/translated-text';
import { deliveryCommandError } from '../feature/delivery-command-error';
import type { DeliveryProcedureOption } from '../models/delivery-procedure-option';
import type { DeliveryScope } from '../models/delivery-scope';
import type {
  DeliveryProblemKind,
  SetDeliveryProcedureInput,
} from '../../../../../../shared/contracts/delivery/index';

@Component({
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressBarModule,
    DelayedLoadingDirective,
    TranslocoPipe,
  ],
  selector: 'app-delivery-procedure-settings',
  styleUrl: './delivery-procedure-settings.scss',
  templateUrl: './delivery-procedure-settings.html',
})
export class DeliveryProcedureSettings {
  private readonly api = inject(DeliveryApi);
  private readonly journal = inject(DELIVERY_JOURNAL);
  private readonly session = inject(SessionFacade);
  private readonly dialog = inject(MatDialogRef<DeliveryProcedureSettings>);
  private readonly identity = computed(() => {
    const state = this.session.state();
    return state.status === 'READY' && state.membership.role === 'HQ'
      ? `${state.membership.userId}:${state.membership.businessId}`
      : undefined;
  });
  readonly kinds = ['DAMAGED', 'MISSING'] as const;
  readonly labels = PROCEDURE_KIND_KEYS;
  readonly record = resource({
    params: () => this.identity(),
    loader: async ({ params }) => ({
      identity: params,
      bindings: await this.api.getProcedureBindings(),
      page: await this.api.listProcedureDocuments({ limit: 20, offset: 0 }),
    }),
  });
  readonly ready = computed(
    () => this.record.hasValue() && this.record.value().identity === this.identity(),
  );
  readonly selection = signal<Record<DeliveryProblemKind, string | null>>({
    DAMAGED: null,
    MISSING: null,
  });
  readonly documents = signal<DeliveryProcedureOption[]>([]);
  readonly nextOffset = signal<number | null>(null);
  readonly pending = signal<SetDeliveryProcedureInput | null>(null);
  readonly busy = signal(false);
  readonly moreBusy = signal(false);
  readonly message = signal<TranslatedText | null>(null);
  readonly recoveryError = signal<TranslatedText | null>(null);
  private owner: string | undefined;
  constructor() {
    effect(() => {
      const identity = this.identity(),
        state = this.session.state();
      if (
        state.status === 'SIGNED_OUT' ||
        state.status === 'NO_ACCESS' ||
        (state.status === 'READY' && state.membership.role !== 'HQ') ||
        (identity && this.owner && identity !== this.owner)
      ) {
        this.dialog.close();
        return;
      }
      if (identity && this.owner !== identity) {
        this.owner = identity;
        untracked(() => this.restorePending());
      }
    });
    effect(() => {
      if (!this.ready()) return;
      const record = this.record.value()!;
      this.selection.set({
        DAMAGED:
          this.pending()?.kind === 'DAMAGED'
            ? this.pending()!.documentId
            : (record.bindings.find((row) => row.kind === 'DAMAGED')?.documentId ?? null),
        MISSING:
          this.pending()?.kind === 'MISSING'
            ? this.pending()!.documentId
            : (record.bindings.find((row) => row.kind === 'MISSING')?.documentId ?? null),
      });
      this.documents.set(record.page.items);
      this.nextOffset.set(record.page.nextOffset);
    });
  }
  private scope(kind: DeliveryProblemKind): DeliveryScope | undefined {
    const state = this.session.state();
    return state.status === 'READY' && state.membership.role === 'HQ'
      ? {
          userId: state.membership.userId,
          businessId: state.membership.businessId,
          salonId: '',
          targetId: kind,
        }
      : undefined;
  }
  private restorePending() {
    this.pending.set(null);
    this.recoveryError.set(null);
    try {
      for (const kind of this.kinds) {
        const scope = this.scope(kind);
        if (!scope) return;
        const saved = this.journal.load(scope);
        if (!saved) continue;
        if (saved.type !== 'SET_PROCEDURE') {
          this.recoveryError.set({ key: 'delivery.errors.differentCommand' });
          return;
        }
        this.pending.set(saved.input);
        return;
      }
    } catch {
      this.recoveryError.set({ key: 'delivery.errors.savedUnreadable' });
    }
  }
  binding(kind: DeliveryProblemKind) {
    return this.ready()
      ? this.record.value()?.bindings.find((row) => row.kind === kind)
      : undefined;
  }
  hasOption(id: string) {
    return this.documents().some((row) => row.documentId === id);
  }
  choose(kind: DeliveryProblemKind, id: string | null) {
    if (!this.busy() && !this.pending() && !this.recoveryError())
      this.selection.update((value) => ({ ...value, [kind]: id }));
  }
  refresh() {
    if (!this.busy()) this.record.reload();
  }
  async loadMore() {
    const offset = this.nextOffset(),
      identity = this.identity();
    if (offset === null || !identity || this.moreBusy()) return;
    this.moreBusy.set(true);
    try {
      const page = await this.api.listProcedureDocuments({ limit: 20, offset });
      if (this.identity() !== identity) return;
      this.documents.update((rows) => [
        ...rows,
        ...page.items.filter((item) => !rows.some((row) => row.documentId === item.documentId)),
      ]);
      this.nextOffset.set(page.nextOffset);
    } catch {
      if (this.identity() === identity)
        this.message.set({ key: 'delivery.settings.errors.loadMore' });
    } finally {
      this.moreBusy.set(false);
    }
  }
  async save(kind: DeliveryProblemKind) {
    const scope = this.scope(kind);
    if (
      !scope ||
      !this.ready() ||
      this.busy() ||
      this.recoveryError() ||
      (this.pending() && this.pending()?.kind !== kind)
    )
      return;
    const identity = this.identity();
    let input = this.pending();
    if (!input) {
      try {
        this.journal.save(scope, {
          type: 'SET_PROCEDURE',
          input: {
            kind,
            documentId: this.selection()[kind],
            expectedRevision: this.binding(kind)?.revision ?? 0,
            idempotencyKey: crypto.randomUUID(),
          },
        });
        const saved = this.journal.load(scope);
        if (saved?.type !== 'SET_PROCEDURE') throw new Error('Saved procedure unavailable.');
        input = saved.input;
        this.pending.set(input);
      } catch {
        this.recoveryError.set({ key: 'delivery.errors.recoveryStorage' });
        return;
      }
    }
    this.busy.set(true);
    this.dialog.disableClose = true;
    this.message.set(null);
    try {
      const result = await this.api.setProcedure(input);
      this.journal.clear(scope);
      if (this.identity() !== identity) return;
      this.restorePending();
      this.message.set({
        key: result.replayed ? 'delivery.settings.replayed' : 'delivery.settings.saved',
      });
      this.record.reload();
    } catch (error) {
      if (this.identity() !== identity) return;
      const e = error as { code?: string };
      if (e.code === 'FORBIDDEN' || e.code === 'UNAUTHENTICATED') {
        this.recoveryError.set({ key: 'delivery.settings.errors.accessChanged' });
        return;
      }
      if (!e.code || e.code === 'UNKNOWN') {
        this.message.set({ key: 'delivery.settings.errors.unknown' });
      } else {
        try {
          this.journal.clear(scope);
          this.restorePending();
        } catch {
          this.recoveryError.set({ key: 'delivery.settings.errors.keepSaved' });
          return;
        }
        this.message.set(deliveryCommandError(e.code));
      }
    } finally {
      this.busy.set(false);
      this.dialog.disableClose = false;
    }
  }
}
