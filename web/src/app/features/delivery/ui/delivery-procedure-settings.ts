import { Component, computed, effect, inject, resource, signal, untracked } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DelayedLoadingDirective } from '../../../shared/ui/delayed-loading/delayed-loading';
import { SessionFacade } from '../../auth/feature/session.facade';
import { DeliveryApi, type DeliveryProcedureOption } from '../data-access/delivery-api';
import { DELIVERY_JOURNAL, type DeliveryScope } from '../feature/delivery-journal';
import type {
  DeliveryProblemKind,
  SetDeliveryProcedureInput,
} from '../../../../../../shared/contracts/delivery';

@Component({
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressBarModule,
    DelayedLoadingDirective,
  ],
  selector: 'app-delivery-procedure-settings',
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    article {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: start;
      margin: 20px 0;
    }
    mat-form-field {
      width: 100%;
    }
    article button {
      margin-top: 5px;
      min-height: 44px;
    }
    p {
      line-height: 1.5;
    }
    .note {
      color: var(--muted);
      font-size: 14px;
    }
  `,
  template: `
    <h2 mat-dialog-title>Delivery procedures</h2>
    <mat-dialog-content>
      <p>Choose the published procedure staff can consult for each delivery problem.</p>
      <mat-progress-bar
        *appDelayedLoading="record.isLoading() || busy()"
        mode="indeterminate"
        aria-label="Loading delivery procedures"
      />
      @if (ready()) {
        @for (kind of kinds; track kind) {
          <article>
            <div>
              <mat-form-field>
                <mat-label>{{ labels[kind] }}</mat-label>
                <mat-select
                  [value]="selection()[kind]"
                  (selectionChange)="choose(kind, $event.value)"
                  [disabled]="busy() || !!pending() || !!recoveryError()"
                >
                  <mat-option [value]="null">No procedure assigned</mat-option>
                  @if (selection()[kind] && !hasOption(selection()[kind]!)) {
                    <mat-option [value]="selection()[kind]">{{
                      binding(kind)?.title ?? 'Current assignment unavailable'
                    }}</mat-option>
                  }
                  @for (document of documents(); track document.documentId) {
                    <mat-option [value]="document.documentId"
                      >{{ document.title }} · {{ document.documentCode }}</mat-option
                    >
                  }
                </mat-select>
              </mat-form-field>
              @if (binding(kind)?.availability === 'UNAVAILABLE') {
                <p class="note">
                  The current procedure is unavailable. Choose another published document or remove
                  the assignment.
                </p>
              }
            </div>
            <button
              mat-button
              (click)="save(kind)"
              [disabled]="
                busy() ||
                !!recoveryError() ||
                (!!pending() && pending()?.kind !== kind) ||
                (!pending() && selection()[kind] === (binding(kind)?.documentId ?? null))
              "
            >
              {{ pending()?.kind === kind ? 'Retry save' : 'Save' }}
            </button>
          </article>
        }
        @if (nextOffset() !== null) {
          <button mat-button (click)="loadMore()" [disabled]="moreBusy() || busy()">
            Load more procedures
          </button>
        }
      }
      @if (record.error()) {
        <p role="alert">
          Delivery procedures unavailable. <button mat-button (click)="refresh()">Retry</button>
        </p>
      }
      @if (recoveryError()) {
        <p role="alert">{{ recoveryError() }}</p>
      }
      @if (message()) {
        <p role="status">{{ message() }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end"
      ><button mat-button (click)="refresh()" [disabled]="busy()">Refresh</button
      ><button mat-button mat-dialog-close [disabled]="busy()">Close</button></mat-dialog-actions
    >
  `,
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
  readonly labels = { DAMAGED: 'Damaged product', MISSING: 'Missing product' };
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
  readonly message = signal('');
  readonly recoveryError = signal('');
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
    this.recoveryError.set('');
    try {
      for (const kind of this.kinds) {
        const scope = this.scope(kind);
        if (!scope) return;
        const saved = this.journal.load(scope);
        if (!saved) continue;
        if (saved.type !== 'SET_PROCEDURE')
          throw new Error('A different saved command needs review.');
        this.pending.set(saved.input);
        return;
      }
    } catch (error) {
      this.recoveryError.set(
        error instanceof Error ? error.message : 'Saved procedure command unavailable.',
      );
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
        this.message.set('Could not load more procedures. Try again.');
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
        this.recoveryError.set(
          'Could not save recovery data in this browser. Enable browser storage before continuing.',
        );
        return;
      }
    }
    this.busy.set(true);
    this.dialog.disableClose = true;
    this.message.set('');
    try {
      const result = await this.api.setProcedure(input);
      this.journal.clear(scope);
      if (this.identity() !== identity) return;
      this.restorePending();
      this.message.set(
        result.replayed ? 'The earlier save was recorded.' : 'Delivery procedure saved.',
      );
      this.record.reload();
    } catch (error) {
      if (this.identity() !== identity) return;
      const e = error as { code?: string; message?: string };
      if (e.code === 'FORBIDDEN' || e.code === 'UNAUTHENTICATED') {
        this.recoveryError.set(
          'Access changed. The saved command is retained. Reopen after access is restored to reconcile it.',
        );
        return;
      }
      if (!e.code || e.code === 'UNKNOWN') {
        this.message.set('Save outcome unknown. Retry with the same selection.');
      } else {
        try {
          this.journal.clear(scope);
          this.restorePending();
        } catch {
          this.recoveryError.set('Keep the saved command and reopen to reconcile it.');
          return;
        }
        this.message.set(e.message ?? 'Could not save the procedure.');
      }
    } finally {
      this.busy.set(false);
      this.dialog.disableClose = false;
    }
  }
}
