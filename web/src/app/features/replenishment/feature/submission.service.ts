import { Service, signal, inject, effect, untracked } from '@angular/core';
import type {
  ReadyDraftLine,
  SubmissionOutcome,
  PendingSubmission,
} from '../../../../../../shared/contracts/draft';
import type { RequestItemInput } from '../../../../../../shared/contracts/stock';
import { SessionFacade } from '../../auth/feature/session.facade';
import { ReplenishmentApi } from '../data-access/replenishment-api';
import { PendingSubmissionStore } from '../data-access/pending-submission.store';
import { CommandError } from '../data-access/command-error';
@Service()
export class SubmissionService {
  private readonly api = inject(ReplenishmentApi);
  private readonly session = inject(SessionFacade);
  private readonly storage = inject(PendingSubmissionStore);
  private readonly working = signal(false);
  private readonly unresolved = signal(false);
  private readonly savedSalon = signal<string | undefined>(undefined);
  private readonly result = signal<SubmissionOutcome | undefined>(undefined);
  private readonly resultSalon = signal<string | undefined>(undefined);
  private readonly frozenItems = signal<RequestItemInput[]>([]);
  private readonly blocking = signal('');
  readonly busy = this.working.asReadonly();
  readonly pending = this.unresolved.asReadonly();
  readonly savedSalonId = this.savedSalon.asReadonly();
  readonly outcome = this.result.asReadonly();
  readonly outcomeSalonId = this.resultSalon.asReadonly();
  readonly submittedItems = this.frozenItems.asReadonly();
  readonly blocked = this.blocking.asReadonly();
  readonly error = signal('');
  private epoch = 0;
  private resultOwner: string | undefined;
  constructor() {
    effect(() => {
      const state = this.session.state();
      untracked(() => {
        if (state.status === 'LOADING' || state.status === 'ERROR') return;
        const stored = this.storage.load();
        if (
          state.status !== 'READY' ||
          (this.resultOwner !== undefined && this.resultOwner !== this.identity()) ||
          (stored.kind === 'PENDING' && !this.owns(stored.value))
        ) {
          this.epoch++;
          this.resultOwner = undefined;
          this.result.set(undefined);
          this.resultSalon.set(undefined);
          this.frozenItems.set([]);
          try {
            this.storage.clearPending();
          } catch {
            /* Preserve unrecognized or inaccessible evidence. */
          }
        }
        this.sync();
      });
    });
  }
  private identity(): string | undefined {
    const s = this.session.state();
    return s.status === 'READY'
      ? JSON.stringify([
          s.membership.userId,
          s.membership.businessId,
          s.membership.role,
          [...s.membership.salonIds].sort(),
        ])
      : undefined;
  }
  private owns(p: PendingSubmission): boolean {
    const s = this.session.state();
    return (
      s.status === 'READY' &&
      (s.membership.role === 'SALON' || s.membership.role === 'HQ') &&
      s.membership.userId === p.userId &&
      s.membership.businessId === p.businessId &&
      s.membership.salonIds.includes(p.salonId)
    );
  }
  private sync() {
    const stored = this.storage.load();
    this.unresolved.set(stored.kind === 'PENDING');
    this.savedSalon.set(stored.kind === 'PENDING' ? stored.value.salonId : undefined);
    this.blocking.set(stored.kind === 'BLOCKED' ? stored.reason : '');
  }
  async submit(salonId: string, lines: ReadyDraftLine[]): Promise<SubmissionOutcome | undefined> {
    if (this.busy()) return;
    this.sync();
    if (this.storage.load().kind !== 'EMPTY') return;
    const s = this.session.state();
    if (
      s.status !== 'READY' ||
      !['SALON', 'HQ'].includes(s.membership.role) ||
      !s.membership.salonIds.includes(salonId)
    )
      return;
    const batch: PendingSubmission = {
      version: 2,
      userId: s.membership.userId,
      businessId: s.membership.businessId,
      salonId,
      payload: {
        salonId,
        items: lines
          .map((i) => ({ productId: i.productId, quantity: i.quantity }))
          .sort((a, b) => (a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0)),
        idempotencyKey: crypto.randomUUID(),
      },
    };
    this.result.set(undefined);
    this.error.set('');
    try {
      this.storage.save(batch);
    } catch {
      this.error.set('Enable browser session storage before submitting. No request was sent.');
      this.sync();
      return;
    }
    return this.run(batch);
  }
  async resume(salonId: string): Promise<SubmissionOutcome | undefined> {
    if (this.busy() || this.session.state().status !== 'READY') return;
    const stored = this.storage.load();
    if (stored.kind !== 'PENDING' || stored.value.salonId !== salonId || !this.owns(stored.value))
      return;
    return this.run(stored.value);
  }
  private async run(batch: PendingSubmission): Promise<SubmissionOutcome | undefined> {
    const epoch = this.epoch;
    this.resultOwner = this.identity();
    this.working.set(true);
    this.frozenItems.set(batch.payload.items.map((i) => ({ ...i })));
    this.error.set('');
    this.sync();
    let outcome: SubmissionOutcome;
    try {
      const response = await this.api.runAction({
        type: 'SUBMIT',
        input: structuredClone(batch.payload),
      });
      outcome = { status: 'CREATED', requestId: response.requestId };
    } catch (error) {
      const e =
        error instanceof CommandError ? error : new CommandError('UNKNOWN', 'Outcome unknown.');
      outcome =
        e.code === 'UNKNOWN'
          ? { status: 'UNKNOWN' }
          : { status: 'FAILED', code: e.code, ...(e.conflicts ? { conflicts: e.conflicts } : {}) };
    }
    try {
      if (epoch !== this.epoch || !this.owns(batch)) return;
      this.result.set(outcome);
      this.resultSalon.set(batch.salonId);
      if (outcome.status !== 'UNKNOWN')
        try {
          this.storage.clearPending();
        } catch {
          this.error.set(
            'Could not clear saved state. Reconcile the same request before continuing.',
          );
        }
      return outcome;
    } finally {
      this.working.set(false);
      this.sync();
    }
  }
}
