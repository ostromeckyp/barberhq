import { Service, computed, effect, inject, resource, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import type {
  DeliveryAction,
  DeliveryCommandResult,
  ProcedureReference,
} from '../../../../../../shared/contracts/delivery/index';
import { SessionFacade } from '../../auth/feature/session.facade';
import { SalonContext } from '../../../core/salon-context';
import { BrowserActivity } from '../../../core/browser-activity';
import { pageOffset } from '../../../core/request-navigation';
import { deliveryIssueQuery } from './delivery-return';
import { DeliveryApi } from '../data-access/delivery-api';
import { DELIVERY_JOURNAL, scopeKey } from './delivery-journal';
import type { DeliveryScope } from '../models/delivery-scope';
type IssueAction =
  | Extract<DeliveryAction, { type: 'ADD_NOTE' }>
  | {
      type: 'START_REVIEW' | 'CREATE_REPLACEMENT';
      input: { issueId: string; expectedRevision: number; idempotencyKey: string };
    };
@Service()
export class DeliveryIssueDraft {
  private readonly session = inject(SessionFacade);
  private readonly workspace = inject(SalonContext);
  readonly note = signal('');
  private owner: { scope: DeliveryScope; view: 'HQ' | 'SALON' } | null = null;
  constructor() {
    effect(() => {
      const s = this.session.state(),
        w = this.workspace.workspace(),
        owner = this.owner;
      if (!owner) return;
      if (
        s.status === 'SIGNED_OUT' ||
        s.status === 'NO_ACCESS' ||
        (s.status === 'READY' &&
          (s.membership.userId !== owner.scope.userId ||
            s.membership.businessId !== owner.scope.businessId ||
            !s.membership.salonIds.includes(owner.scope.salonId) ||
            (w &&
              (w.kind !== owner.view ||
                (w.kind === 'SALON' && w.salonId !== owner.scope.salonId)))))
      ) {
        this.note.set('');
        this.owner = null;
      }
    });
  }
  activate(scope: DeliveryScope, view: 'HQ' | 'SALON') {
    if (!this.owner || scopeKey(this.owner.scope) !== scopeKey(scope) || this.owner.view !== view) {
      this.note.set('');
      this.owner = { scope, view };
    }
  }
}
@Service({ autoProvided: false })
export class DeliveryIssueFacade {
  private readonly api = inject(DeliveryApi);
  private readonly session = inject(SessionFacade);
  private readonly workspace = inject(SalonContext);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly activity = inject(BrowserActivity);
  private readonly journal = inject(DELIVERY_JOURNAL);
  private readonly params = toSignal(this.route.paramMap);
  private readonly query = toSignal(this.route.queryParamMap);
  readonly draft = inject(DeliveryIssueDraft);
  readonly view: 'HQ' | 'SALON' = this.route.snapshot.data['workspace'];
  private readonly identity = computed(() => {
    const s = this.session.state(),
      w = this.workspace.workspace(),
      id = this.params()?.get('issueId'),
      salonId = this.params()?.get('salonId');
    if (s.status !== 'READY' || !id) return undefined;
    if (this.view === 'HQ' && (s.membership.role !== 'HQ' || w?.kind !== 'HQ')) return undefined;
    if (
      this.view === 'SALON' &&
      (!salonId ||
        !s.membership.salonIds.includes(salonId) ||
        w?.kind !== 'SALON' ||
        w.salonId !== salonId)
    )
      return undefined;
    return {
      id,
      userId: s.membership.userId,
      businessId: s.membership.businessId,
      salonId,
      key: JSON.stringify([s.membership.userId, s.membership.businessId, this.view, id, salonId]),
    };
  });
  readonly eventOffset = signal(0);
  readonly replacementOffset = signal(0);
  private readonly record = resource({
    params: () => {
      const identity = this.identity();
      return identity
        ? {
            ...identity,
            eventOffset: this.eventOffset(),
            replacementOffset: this.replacementOffset(),
            tick: this.activity.refreshTick(),
          }
        : undefined;
    },
    loader: async ({ params }) => {
      const issue = await this.api.getIssue(params.id, {
        eventOffset: params.eventOffset,
        replacementOffset: params.replacementOffset,
      });
      if (issue.id !== params.id || (params.salonId && issue.salonId !== params.salonId))
        throw new Error('Issue outside this salon.');
      return { key: params.key, issue };
    },
  });
  readonly issue = computed(() =>
    this.record.hasValue() && this.record.value().key === this.identity()?.key
      ? this.record.value().issue
      : undefined,
  );
  readonly scope = computed<DeliveryScope | undefined>(() => {
    const i = this.issue(),
      identity = this.identity(),
      s = this.session.state();
    return i && identity && s.status === 'READY' && s.membership.salonIds.includes(i.salonId)
      ? {
          userId: identity.userId,
          businessId: identity.businessId,
          salonId: i.salonId,
          targetId: i.id,
        }
      : undefined;
  });
  private readonly procedureRecord = resource({
    params: () => {
      const scope = this.scope(),
        issue = this.issue();
      return scope && issue ? { key: scopeKey(scope), requestId: issue.rootRequestId } : undefined;
    },
    loader: async ({ params }) => ({
      key: params.key,
      procedures: await this.api.getProcedures(params.requestId),
    }),
  });
  readonly procedures = computed(() => {
    const scope = this.scope();
    return scope &&
      this.procedureRecord.hasValue() &&
      this.procedureRecord.value().key === scopeKey(scope)
      ? this.procedureRecord.value().procedures
      : undefined;
  });
  readonly loading = this.record.isLoading;
  readonly error = computed(() => !!this.record.error());
  readonly busy = signal(false);
  readonly pending = signal<IssueAction | null>(null);
  readonly unknown = computed(() => !!this.pending());
  readonly message = signal('');
  readonly recoveryError = signal('');
  readonly isHq = computed(() => !!this.scope() && this.view === 'HQ');
  readonly locked = computed(
    () => !this.isHq() || this.loading() || this.busy() || this.unknown() || !!this.recoveryError(),
  );
  readonly canReview = computed(() => !this.locked() && this.issue()?.status === 'OPEN');
  readonly canCreate = computed(() => {
    const issue = this.issue();
    return (
      !this.locked() &&
      !!issue &&
      ['OPEN', 'IN_REVIEW'].includes(issue.status) &&
      !issue.activeReplacement &&
      issue.items.some((row) => row.outstandingQuantity > 0)
    );
  });
  readonly canNote = computed(
    () =>
      !this.locked() &&
      this.issue()?.status !== 'RESOLVED' &&
      this.draft.note().trim().length > 0 &&
      this.draft.note().trim().length <= 1000,
  );
  readonly statusLabel = computed(() => {
    const status = this.issue()?.status;
    return status
      ? {
          OPEN: 'Open',
          IN_REVIEW: 'Under review',
          REPLACEMENT_IN_PROGRESS: 'Replacement in progress',
          RESOLVED: 'Resolved',
        }[status]
      : '';
  });
  private owner: string | undefined;
  constructor() {
    effect(() => {
      const scope = this.scope();
      if (!scope) return;
      const key = scopeKey(scope) + this.view;
      if (this.owner === key) return;
      this.owner = key;
      untracked(() => this.draft.activate(scope, this.view));
      this.pending.set(null);
      this.message.set('');
      this.recoveryError.set('');
      if (this.view === 'HQ')
        try {
          const saved = this.journal.load(scope);
          if (saved) {
            if (!['START_REVIEW', 'CREATE_REPLACEMENT', 'ADD_NOTE'].includes(saved.type))
              throw new Error('A different saved command needs review.');
            this.pending.set(saved as IssueAction);
            if (saved.type === 'ADD_NOTE') this.draft.note.set(saved.input.text);
          }
        } catch (error) {
          this.recoveryError.set(
            error instanceof Error ? error.message : 'Saved action unavailable.',
          );
        }
    });
  }
  requestLink(id: string) {
    const scope = this.scope();
    return this.view === 'HQ'
      ? ['/hq', 'requests', id]
      : ['/salons', scope?.salonId ?? '', 'requests', id];
  }
  goBack() {
    const scope = this.scope();
    if (!scope) return;
    if (this.view === 'HQ')
      void this.router.navigate(['/hq'], {
        queryParams: {
          view: 'delivery-issues',
          issueStatus: this.query()?.get('issueStatus') === 'ALL' ? 'ALL' : 'OPEN',
          issueOffset: pageOffset(this.query()?.get('issueOffset')),
        },
      });
    else void this.router.navigate(this.requestLink(this.issue()!.rootRequestId));
  }
  openProcedure(ref: ProcedureReference) {
    const scope = this.scope();
    if (scope)
      void this.router.navigate(['/procedures', 'sources', ref.versionId], {
        queryParams: {
          chunk: ref.chunkId,
          returnTo: 'delivery-issue',
          issueId: scope.targetId,
          salonId: scope.salonId,
          workspace: this.view,
          ...deliveryIssueQuery(this.query()),
        },
      });
  }
  refresh() {
    if (!this.busy()) {
      this.record.reload();
      this.procedureRecord.reload();
    }
  }
  eventsBy(delta: number) {
    const issue = this.issue();
    if (!issue || this.loading() || (delta > 0 && !issue.hasMoreEvents)) return;
    this.eventOffset.update((v) => Math.max(0, v + delta * 20));
  }
  replacementsBy(delta: number) {
    const issue = this.issue();
    if (!issue || this.loading() || (delta > 0 && !issue.hasMoreReplacements)) return;
    this.replacementOffset.update((v) => Math.max(0, v + delta * 20));
  }
  async act(type: IssueAction['type']): Promise<void> {
    if (
      type === 'START_REVIEW'
        ? !this.canReview()
        : type === 'CREATE_REPLACEMENT'
          ? !this.canCreate()
          : !this.canNote()
    )
      return;
    const issue = this.issue()!,
      scope = this.scope()!,
      input = {
        issueId: issue.id,
        expectedRevision: issue.revision,
        idempotencyKey: crypto.randomUUID(),
      };
    const action: IssueAction =
      type === 'ADD_NOTE'
        ? { type, input: { ...input, text: this.draft.note().trim() } }
        : { type, input };
    try {
      this.journal.save(scope, action);
      const saved = this.journal.load(scope);
      if (!saved) throw new Error();
      this.pending.set(saved as IssueAction);
    } catch {
      this.recoveryError.set(
        'Could not save recovery data in this browser. Enable browser storage before continuing.',
      );
      return;
    }
    await this.retry();
  }
  async retry(): Promise<void> {
    const scope = this.scope(),
      action = this.pending();
    if (!scope || !action || !this.isHq() || this.busy() || this.loading() || this.recoveryError())
      return;
    this.busy.set(true);
    this.message.set('');
    try {
      const result: DeliveryCommandResult =
        action.type === 'ADD_NOTE'
          ? await this.api.addNote(action.input)
          : action.type === 'START_REVIEW'
            ? await this.api.startReview(action.input)
            : await this.api.createReplacement(action.input);
      this.journal.clear(scope);
      if (!this.scope() || scopeKey(this.scope()!) !== scopeKey(scope) || !this.isHq()) return;
      this.pending.set(null);
      if (action.type === 'ADD_NOTE') this.draft.note.set('');
      this.message.set(result.replayed ? 'The earlier action was recorded.' : 'Action recorded.');
      this.record.reload();
    } catch (error) {
      if (!this.scope() || scopeKey(this.scope()!) !== scopeKey(scope) || !this.isHq()) return;
      const e = error as { code?: string; message?: string };
      if (e.code === 'FORBIDDEN' || e.code === 'UNAUTHENTICATED') {
        this.recoveryError.set(
          'Access changed. The saved command is retained. Reload after access is restored to reconcile it.',
        );
        return;
      }
      if (!e.code || e.code === 'UNKNOWN')
        this.message.set('Outcome unknown. Retry the saved action before making changes.');
      else {
        try {
          this.journal.clear(scope);
          this.pending.set(null);
        } catch {
          this.message.set('Keep the saved action and retry reconciliation.');
          return;
        }
        this.message.set(
          e.code === 'ALREADY_ACTIVE'
            ? 'An active request already covers this product. Finish it before creating a replacement.'
            : (e.message ?? 'Action was not recorded. Refresh and try again.'),
        );
        this.record.reload();
      }
    } finally {
      this.busy.set(false);
    }
  }
}
