import { DestroyRef, Service, computed, effect, inject, signal } from '@angular/core';
import type { ProcedureResult } from '../../../../../shared/contracts/ai/index';
import { AssistantApi, AssistantApiError } from '../../core/assistant-api';
import { Language } from '../../core/language';
import type { TranslatedText } from '../../core/models/translated-text';
import { SalonContext } from '../../core/salon-context';
import { SessionFacade } from '../auth/feature/session.facade';
import { TranslocoService } from '@jsverse/transloco';
import type { ParamMap } from '@angular/router';
import { deliveryReturn } from '../delivery/feature/delivery-return';
import { deliveryProcedureQuestion } from './procedure-question';

// Keep only the current question/result in memory while its cited PDF is open.
// The scope effect below clears it on account or workspace changes.
@Service()
export class AssistantFacade {
  private readonly api = inject(AssistantApi);
  private readonly session = inject(SessionFacade);
  private readonly context = inject(SalonContext);
  private readonly language = inject(Language);
  private readonly transloco = inject(TranslocoService);
  private generation = 0;
  private scope = '';
  private readonly deliveryQuery = signal<ParamMap | null>(null);
  readonly deliveryBack = computed(() => {
    const session = this.session.state(),
      query = this.deliveryQuery();
    return session.status === 'READY' && query
      ? deliveryReturn(query, session.membership, this.context.workspace())
      : null;
  });
  readonly question = signal('');
  readonly submittedQuestion = signal('');
  readonly loading = signal(false);
  readonly result = signal<ProcedureResult | null>(null);
  readonly error = signal<TranslatedText | null>(null);
  readonly canSubmit = computed(
    () => !!this.question().trim() && !this.loading() && this.session.state().status === 'READY',
  );

  constructor() {
    effect(() => {
      const next = this.currentScope();
      if (next !== this.scope) {
        this.scope = next;
        this.deliveryQuery.set(null);
        this.reset();
      }
    });
    inject(DestroyRef).onDestroy(() => {
      this.generation++;
    });
  }

  suggestDeliveryQuestion(query: ParamMap): boolean {
    const key = deliveryProcedureQuestion(query.get('deliveryProblem'));
    const state = this.session.state();
    if (
      !key ||
      state.status !== 'READY' ||
      query.get('returnTo') !== 'delivery-receipt' ||
      !deliveryReturn(query, state.membership, this.context.workspace())
    )
      return false;
    // An explicit new suggestion replaces previous guidance, but never submits it.
    this.reset();
    this.deliveryQuery.set(query);
    this.question.set(this.transloco.translate(key, {}, this.language.current()));
    return true;
  }

  reset(): void {
    this.generation++;
    this.question.set('');
    this.submittedQuestion.set('');
    this.result.set(null);
    this.error.set(null);
    this.loading.set(false);
  }

  async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    const generation = ++this.generation;
    const scope = this.currentScope();
    const question = this.question().trim();
    this.submittedQuestion.set(question);
    this.result.set(null);
    this.error.set(null);
    this.loading.set(true);
    try {
      const result = await this.api.answerProcedureQuestion({
        question,
        answerLanguage: this.language.current(),
      });
      if (generation === this.generation && scope === this.currentScope()) this.result.set(result);
    } catch (error) {
      if (generation === this.generation && scope === this.currentScope()) {
        this.error.set({
          key:
            error instanceof AssistantApiError
              ? error.key
              : 'procedures.assistant.errors.UNAVAILABLE',
        });
      }
    } finally {
      if (generation === this.generation && scope === this.currentScope()) this.loading.set(false);
    }
  }

  private currentScope(): string {
    const state = this.session.state();
    const workspace = this.context.workspace();
    return state.status === 'READY'
      ? [
          state.membership.userId,
          state.membership.businessId,
          workspace?.kind ?? 'none',
          workspace?.kind === 'SALON' ? workspace.salonId : '',
        ].join(':')
      : state.status;
  }
}
