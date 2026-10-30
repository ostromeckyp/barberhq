import { Service, computed, effect, inject, resource, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import type {
  DeliveryCommandResult,
  DeliveryProblemKind,
  DeliveryProcedureDto,
  RecordDeliveryInput,
} from '../../../../../../shared/contracts/delivery/index';
import { SessionFacade } from '../../auth/feature/session.facade';
import { SalonContext } from '../../../core/salon-context';
import { DeliveryApi } from '../data-access/delivery-api';
import { DeliveryDraftStore } from './delivery-draft.store';
import { deliveryReceiptQuery } from './delivery-return';
import { DELIVERY_JOURNAL, scopeKey } from './delivery-journal';
import type { DeliveryScope } from '../models/delivery-scope';
import { deliveryReceiptScope } from './delivery-access';
import { receiptInput, receiptProcedureProblem, receiptValidation } from './delivery-receipt-input';
import { runtimeConfig } from '../../../core/public-config';
import { deliveryProcedureQuestion } from '../../procedures/procedure-question';
@Service({ autoProvided: false })
export class DeliveryReceiptFacade {
  private readonly api = inject(DeliveryApi);
  private readonly session = inject(SessionFacade);
  private readonly workspace = inject(SalonContext);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.paramMap);
  private readonly query = toSignal(this.route.queryParamMap);
  private readonly journal = inject(DELIVERY_JOURNAL);
  readonly draft = inject(DeliveryDraftStore);
  readonly scope = computed<DeliveryScope | undefined>(() => {
    const p = this.params();
    return deliveryReceiptScope(
      this.session.state(),
      this.workspace.workspace(),
      p?.get('salonId'),
      p?.get('requestId'),
    );
  });
  private readonly record = resource({
    params: () => this.scope(),
    loader: async ({ params }) => {
      const context = await this.api.getReceiptContext(params.targetId);
      if (context.request.salonId !== params.salonId || context.request.id !== params.targetId)
        throw new Error('Delivery outside this salon.');
      return { key: scopeKey(params), context };
    },
  });
  readonly context = computed(() => {
    const scope = this.scope();
    return scope && this.record.hasValue() && this.record.value().key === scopeKey(scope)
      ? this.record.value().context
      : undefined;
  });
  readonly products = computed(
    () => new Map(this.context()?.request.items.map((item) => [item.productId, item]) ?? []),
  );
  readonly loading = this.record.isLoading;
  readonly error = computed(() => !!this.record.error());
  readonly pending = signal<RecordDeliveryInput | null>(null);
  readonly busy = signal(false);
  readonly result = signal<DeliveryCommandResult | null>(null);
  readonly message = signal('');
  readonly recoveryError = signal('');
  readonly unknown = computed(() => !!this.pending());
  readonly locked = computed(
    () =>
      !this.scope() ||
      !this.context() ||
      this.loading() ||
      this.busy() ||
      this.unknown() ||
      !!this.recoveryError() ||
      !!this.context()?.summary.receipt ||
      !!this.result(),
  );
  readonly totals = computed(() =>
    this.draft.model().items.reduce(
      (sum, row) => ({
        good: sum.good + row.goodQuantity,
        affected: sum.affected + row.damagedQuantity + row.missingQuantity,
      }),
      { good: 0, affected: 0 },
    ),
  );
  private readonly procedureProblem = computed(() =>
    receiptProcedureProblem(this.draft.model().items),
  );
  readonly procedureQuestionKey = computed(() =>
    runtimeConfig.publicConfig?.ragEnabled && runtimeConfig.publicConfig.knowledgeEnabled
      ? deliveryProcedureQuestion(this.procedureProblem())
      : null,
  );
  readonly validation = computed(() =>
    receiptValidation(this.context(), this.draft.model(), () => this.totals().affected),
  );
  readonly canSubmit = computed(
    () =>
      !this.busy() &&
      !!this.scope() &&
      !!this.context() &&
      !this.loading() &&
      !this.recoveryError() &&
      (this.unknown() || (!this.locked() && !this.validation())),
  );
  private owner: string | undefined;
  constructor() {
    effect(() => {
      const scope = this.scope();
      if (!scope) return;
      const key = scopeKey(scope);
      if (this.owner === key) return;
      this.owner = key;
      this.pending.set(null);
      this.result.set(null);
      this.message.set('');
      this.recoveryError.set('');
      try {
        const saved = this.journal.load(scope);
        if (saved) {
          if (saved.type !== 'RECORD_RECEIPT')
            throw new Error('A different saved command needs review.');
          this.pending.set(saved.input);
        }
      } catch (e) {
        this.recoveryError.set(e instanceof Error ? e.message : 'Saved inspection unavailable.');
      }
    });
    effect(() => {
      const ctx = this.context(),
        scope = this.scope();
      if (!ctx || !scope) return;
      untracked(() => {
        const previous = this.draft.scope();
        const isNew = !previous || scopeKey(previous) !== scopeKey(scope);
        this.draft.activate(
          scope,
          ctx.request.items.map((row) => ({
            productId: row.productId,
            goodQuantity: 0,
            damagedQuantity: 0,
            missingQuantity: 0,
          })),
        );
        if (isNew) {
          const saved = this.pending();
          if (saved)
            this.draft.model.set({
              items: saved.items.map((row) => ({ ...row })),
              description: saved.report?.description ?? '',
              batchIdentifier: saved.report?.batchIdentifier ?? '',
              procedureReferences: saved.procedureReferences.map((row) => ({ ...row })),
            });
        }
      });
    });
  }
  refresh() {
    if (!this.busy()) this.record.reload();
  }
  markAllGood() {
    const context = this.context();
    if (!context || this.locked()) return;
    this.draft.model.update((draft) => ({
      ...draft,
      items: context.request.items.map((item) => ({
        productId: item.productId,
        goodQuantity: item.dispatchedQuantity,
        damagedQuantity: 0,
        missingQuantity: 0,
      })),
    }));
  }
  removeReference(kind: DeliveryProblemKind) {
    if (!this.locked())
      this.draft.model.update((v) => ({
        ...v,
        procedureReferences: v.procedureReferences.filter((ref) => ref.kind !== kind),
      }));
  }
  openProcedureAssistant() {
    const scope = this.scope();
    if (!scope || this.locked() || !this.procedureQuestionKey()) return;
    void this.router.navigate(['/procedures'], {
      queryParams: {
        tab: 'assistant',
        deliveryProblem: this.procedureProblem(),
        returnTo: 'delivery-receipt',
        salonId: scope.salonId,
        requestId: scope.targetId,
        ...deliveryReceiptQuery(this.query()),
      },
    });
  }
  openProcedure(procedure: DeliveryProcedureDto) {
    const scope = this.scope(),
      reference = procedure.reference;
    if (!scope || !reference || this.locked()) return;
    this.draft.model.update((v) => ({
      ...v,
      procedureReferences: [
        ...v.procedureReferences.filter((ref) => ref.kind !== reference.kind),
        { ...reference },
      ],
    }));
    void this.router.navigate(['/procedures', 'sources', reference.versionId], {
      queryParams: {
        chunk: reference.chunkId,
        returnTo: 'delivery-receipt',
        salonId: scope.salonId,
        requestId: scope.targetId,
        ...deliveryReceiptQuery(this.query()),
      },
    });
  }
  goBack() {
    const scope = this.scope();
    if (scope)
      void this.router.navigate(['/salons', scope.salonId, 'requests', scope.targetId], {
        state: {
          listContext: {
            kind: 'SALON',
            salonId: scope.salonId,
            ...(deliveryReceiptQuery(this.query()) ?? { filter: 'ALL', offset: 0 }),
          },
        },
      });
  }
  async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    const scope = this.scope()!,
      context = this.context()!,
      draft = this.draft.model();
    let input = this.pending();
    if (!input) {
      input = receiptInput(scope, context, draft, this.totals().affected);
      try {
        this.journal.save(scope, { type: 'RECORD_RECEIPT', input });
        const saved = this.journal.load(scope);
        if (saved?.type !== 'RECORD_RECEIPT') throw new Error('Recovery data unavailable.');
        input = saved.input;
        this.pending.set(input);
      } catch {
        this.recoveryError.set(
          'Could not save recovery data in this browser. Enable browser storage before recording the inspection.',
        );
        return;
      }
    }
    this.busy.set(true);
    this.message.set('');
    try {
      const result = await this.api.recordReceipt(input);
      this.journal.clear(scope);
      if (this.scope() && scopeKey(this.scope()!) === scopeKey(scope)) {
        this.pending.set(null);
        this.result.set(result);
        this.message.set(
          result.replayed ? 'The earlier inspection was recorded.' : 'Inspection recorded.',
        );
        this.record.reload();
      }
    } catch (error) {
      if (!this.scope() || scopeKey(this.scope()!) !== scopeKey(scope)) return;
      const e = error as { code?: string; message?: string };
      if (e.code === 'FORBIDDEN' || e.code === 'UNAUTHENTICATED') {
        this.recoveryError.set(
          'Access changed. The saved command is retained. Reload after access is restored to reconcile it.',
        );
        return;
      }
      if (!e.code || e.code === 'UNKNOWN') {
        this.message.set('Outcome unknown. Retry the saved inspection before making changes.');
      } else {
        try {
          this.journal.clear(scope);
          this.pending.set(null);
        } catch {
          this.message.set('Keep the saved inspection and retry reconciliation.');
          return;
        }
        this.message.set(
          e.message ?? 'Inspection was not recorded. Refresh and check the details.',
        );
        this.record.reload();
      }
    } finally {
      this.busy.set(false);
    }
  }
}
