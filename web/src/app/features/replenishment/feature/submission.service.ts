import { Service, signal, inject, effect, untracked } from '@angular/core';
import type {
  ReadyDraftLine,
  SubmissionRow,
  PendingSubmission,
} from '../../../../../../shared/contracts/draft';
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
  readonly savedSalonId = this.savedSalon.asReadonly();
  private readonly outcomes = signal<SubmissionRow[]>([]);
  readonly busy = this.working.asReadonly();
  readonly pending = this.unresolved.asReadonly();
  readonly rows = this.outcomes.asReadonly();
  readonly error = signal('');
  constructor() {
    effect(() => {
      const state = this.session.state();
      untracked(() => {
        if (state.status === 'LOADING' || state.status === 'ERROR') return;
        const pending = this.storage.load();
        if (state.status !== 'READY' || (pending && !this.owns(pending))) {
          this.storage.clear();
          this.unresolved.set(false);
          this.savedSalon.set(undefined);
          this.outcomes.set([]);
        } else {
          this.unresolved.set(!!pending?.rows.length);
          this.savedSalon.set(pending?.salonId);
        }
      });
    });
  }
  private owns(batch: PendingSubmission) {
    const s = this.session.state();
    return (
      s.status === 'READY' &&
      s.membership.role === 'SALON' &&
      s.membership.userId === batch.userId &&
      s.membership.businessId === batch.businessId &&
      s.membership.salonIds.includes(batch.salonId)
    );
  }
  async submit(salonId: string, lines: ReadyDraftLine[]): Promise<SubmissionRow[]> {
    if (this.busy() || this.storage.load()) return this.rows();
    const s = this.session.state();
    if (
      s.status !== 'READY' ||
      s.membership.role !== 'SALON' ||
      !s.membership.salonIds.includes(salonId)
    )
      return [];
    const batch: PendingSubmission = {
      userId: s.membership.userId,
      businessId: s.membership.businessId,
      salonId,
      rows: lines.map((line) => ({
        lineId: line.lineId,
        status: 'UNSENT',
        payload: {
          salonId,
          productId: line.productId,
          quantity: line.quantity,
          idempotencyKey: crypto.randomUUID(),
        },
      })),
    };
    this.outcomes.set([]);
    this.error.set('');
    try {
      this.storage.save(batch);
    } catch {
      this.error.set('Enable browser session storage before submitting. No request was sent.');
      return [];
    }
    return this.run(batch);
  }
  async resume(salonId: string): Promise<SubmissionRow[]> {
    if (this.busy() || this.session.state().status !== 'READY') return this.rows();
    const batch = this.storage.load();
    if (!batch || batch.salonId !== salonId) return this.rows();
    if (!this.owns(batch)) {
      this.storage.clear();
      this.unresolved.set(false);
      this.savedSalon.set(undefined);
      return [];
    }
    return this.run(batch);
  }
  private async run(batch: PendingSubmission): Promise<SubmissionRow[]> {
    this.savedSalon.set(batch.salonId);
    this.working.set(true);
    this.unresolved.set(true);
    this.error.set('');
    try {
      while (batch.rows.length && this.owns(batch)) {
        const row = batch.rows[0];
        let outcome: SubmissionRow;
        try {
          const response = await this.api.runAction({ type: 'SUBMIT', input: { ...row.payload } });
          outcome = { ...row, status: 'CREATED', requestId: response.requestId };
        } catch (error) {
          const e =
            error instanceof CommandError ? error : new CommandError('UNKNOWN', 'Outcome unknown.');
          outcome = {
            ...row,
            status:
              e.code === 'ALREADY_ACTIVE'
                ? 'ALREADY_ACTIVE'
                : e.code === 'UNKNOWN'
                  ? 'UNKNOWN'
                  : 'FAILED',
            errorCode: e.code,
            ...(e.requestId ? { requestId: e.requestId } : {}),
          };
        }
        if (!this.owns(batch)) break;
        this.outcomes.update((rows) => [...rows.filter((r) => r.lineId !== row.lineId), outcome]);
        if (outcome.status === 'UNKNOWN') {
          row.status = 'UNKNOWN';
          this.storage.save(batch);
          break;
        }
        batch.rows.shift();
        if (batch.rows.length) this.storage.save(batch);
        else this.storage.clear();
      }
    } catch {
      this.error.set(
        'Could not save progress. Keep this page open and reconcile before continuing.',
      );
    } finally {
      this.working.set(false);
      const status = this.session.state().status;
      const retain =
        batch.rows.length > 0 && (this.owns(batch) || status === 'ERROR' || status === 'LOADING');
      this.unresolved.set(retain);
      this.savedSalon.set(retain ? batch.salonId : undefined);
    }
    return this.rows();
  }
}
