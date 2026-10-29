import { DestroyRef, Service, computed, effect, inject, signal } from '@angular/core';
import type { PrepareInput, ProposalResult } from '../../../../../../shared/contracts/ai/index';
import { AssistantApi, AssistantApiError } from '../../../core/assistant-api';
import { SessionFacade } from '../../auth/feature/session.facade';
import { DraftStore } from './draft.store';
import { OrderFacade } from './order.facade';
type Choice = NonNullable<PrepareInput['clarifications']>[number];
type Attempt = { message: string; prefix: string; choices: Map<string, Choice> };
@Service({ autoProvided: false })
export class ReplenishmentAssistantFacade {
  private readonly api = inject(AssistantApi);
  private readonly session = inject(SessionFacade);
  private readonly order = inject(OrderFacade);
  private readonly draft = inject(DraftStore);
  private generation = 0;
  private scope = '';
  private readonly sources = new Map<
    string,
    { attempt: Attempt; serverId: string; wording: string; receiptId?: string }
  >();
  readonly message = signal('');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly shorthandNotice = signal('');
  readonly excluded = signal<ProposalResult['excluded']>([]);
  readonly canPrepare = computed(
    () =>
      this.order.canOrder() &&
      !this.order.locked() &&
      !this.loading() &&
      !!this.message().trim() &&
      [...this.message()].length <= 2000,
  );
  constructor() {
    effect(() => {
      const scope = this.currentScope();
      if (scope !== this.scope) {
        this.scope = scope;
        this.reset();
      }
    });
    inject(DestroyRef).onDestroy(() => {
      this.generation++;
    });
  }
  private currentScope() {
    const s = this.session.state();
    return s.status === 'READY'
      ? JSON.stringify([
          s.membership.userId,
          s.membership.businessId,
          s.membership.role,
          this.order.salonId(),
        ])
      : s.status;
  }
  private reset() {
    this.generation++;
    this.message.set('');
    this.loading.set(false);
    this.error.set('');
    this.notice.set('');
    this.shorthandNotice.set('');
    this.excluded.set([]);
    this.sources.clear();
  }
  async prepare(): Promise<void> {
    if (!this.canPrepare()) return;
    const attempt: Attempt = {
      message: this.message().trim(),
      prefix: crypto.randomUUID(),
      choices: new Map(),
    };
    await this.request(attempt);
  }
  async clarify(id: string, productId: string, quantity: number): Promise<void> {
    const source = this.sources.get(id);
    if (
      !source ||
      this.loading() ||
      this.order.locked() ||
      !this.draft.lines().some((l) => l.lineId === id && l.status === 'NEEDS_CLARIFICATION')
    )
      return;
    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      this.error.set('Choose a product and a whole quantity from 1 to 99.');
      return;
    }
    const choice = {
      lineId: source.serverId,
      originalWording: source.wording,
      productId,
      quantity,
      // The opaque receipt is the only way an explicit choice may teach salon shorthand.
      ...(source.receiptId ? { choiceReceiptId: source.receiptId } : {}),
    };
    await this.request(source.attempt, { localId: id, choice });
  }
  private async request(attempt: Attempt, selection?: { localId: string; choice: Choice }) {
    const generation = ++this.generation,
      scope = this.currentScope(),
      epoch = this.draft.clearEpoch();
    const choices = new Map(attempt.choices);
    if (selection) choices.set(selection.choice.lineId, selection.choice);
    const current = () =>
      generation === this.generation &&
      scope === this.currentScope() &&
      epoch === this.draft.clearEpoch() &&
      !this.order.locked();
    this.loading.set(true);
    this.error.set('');
    this.notice.set('');
    this.shorthandNotice.set('');
    try {
      const result = await this.api.prepareReplenishment({
        salonId: this.order.salonId()!,
        message: attempt.message,
        ...(choices.size ? { clarifications: [...choices.values()] } : {}),
      });
      if (!current()) return;
      // The server combines duplicate products under their first source ID. Apply only
      // this explicit contribution; previous source quantities are already in the draft.
      const unresolved = selection
        ? result.lines.find(
            (l) => l.lineId === selection.choice.lineId && l.status === 'NEEDS_CLARIFICATION',
          )
        : undefined;
      const verified = selection
        ? result.lines.find(
            (l) => l.status === 'READY' && l.productId === selection.choice.productId,
          )
        : undefined;
      const incoming = selection
        ? unresolved
          ? [unresolved]
          : verified
            ? [
                {
                  ...verified,
                  lineId: selection.choice.lineId,
                  quantity: selection.choice.quantity!,
                },
              ]
            : []
        : result.lines;
      const excluded = selection
        ? result.excluded
            .filter((e) => e.productId === selection.choice.productId)
            .map((e) => ({ ...e, lineId: selection.choice.lineId }))
        : result.excluded;
      if (selection && incoming.length === 0 && excluded.length === 0) {
        this.error.set(
          'The clarification could not be matched. Remove the item and prepare it again.',
        );
        return;
      }
      const local = incoming.map((l) => ({ ...l, lineId: `${attempt.prefix}:${l.lineId}` }));
      if (!this.draft.mergeProposal(local, selection ? [selection.localId] : [])) {
        this.error.set(
          'The list can contain up to six items. Remove an item before adding this proposal.',
        );
        return;
      }
      attempt.choices = choices;
      if (selection) this.sources.delete(selection.localId);
      for (const line of incoming)
        if (line.status === 'NEEDS_CLARIFICATION')
          this.sources.set(`${attempt.prefix}:${line.lineId}`, {
            attempt,
            serverId: line.lineId,
            wording: line.originalWording,
            ...(line.choiceReceiptId ? { receiptId: line.choiceReceiptId } : {}),
          });
      this.excluded.set(excluded);
      const learned = selection
        ? result.shorthandLearning?.find((l) => l.lineId === selection.choice.lineId)
        : undefined;
      this.shorthandNotice.set(
        learned?.status === 'LEARNED'
          ? 'Saved as salon shorthand. You can remove it in Settings.'
          : learned?.status === 'NOT_SAVED' && !unresolved
            ? 'Product applied. The salon shorthand was not saved; choose again next time.'
            : '',
      );
      this.notice.set(
        incoming.some((l) => l.status === 'NEEDS_CLARIFICATION')
          ? 'Review the unresolved items below.'
          : incoming.length
            ? 'Proposal added. Review quantities, then submit the request.'
            : excluded.length
              ? 'These products already have active requests.'
              : 'Specify products and quantities, then prepare the proposal again.',
      );
    } catch (error) {
      if (current()) {
        const code = error instanceof AssistantApiError ? error.code : '';
        this.error.set(
          (code === 'RATE_LIMITED'
            ? 'The shared AI limit has been reached. '
            : code === 'TIMEOUT'
              ? 'The assistant took too long. '
              : 'The proposal could not be prepared. ') +
            'Use Manual to continue; your list is preserved.',
        );
      }
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
}
