import { Service, computed, effect, inject, signal } from '@angular/core';
import type {
  KnowledgeProductWorkspace,
  KnowledgeProductReview,
  KnowledgePassageRef,
  AliasProposal,
  ProductProfileProposal,
  SaveKnowledgeProductReviewInput,
  AcceptKnowledgeProductReviewInput,
  GenerateKnowledgeProductAliasesInput,
  SuggestKnowledgeProductLinkInput,
} from '../../../../../../shared/contracts/product-knowledge';
import { KnowledgeApi } from '../../../core/knowledge-api';
import { SalonContext } from '../../../core/salon-context';
import { SessionFacade } from '../../auth/feature/session.facade';
type Pending =
  | { action: 'save'; input: SaveKnowledgeProductReviewInput }
  | { action: 'accept'; input: AcceptKnowledgeProductReviewInput }
  | { action: 'generate'; input: GenerateKnowledgeProductAliasesInput }
  | { action: 'suggest'; input: SuggestKnowledgeProductLinkInput };
@Service({ autoProvided: false })
export class ProductKnowledgeReviewFacade {
  private readonly api = inject(KnowledgeApi);
  private readonly session = inject(SessionFacade);
  private readonly context = inject(SalonContext, { optional: true });
  private generation = 0;
  private scope = '';
  private versionId = '';
  readonly workspace = signal<KnowledgeProductWorkspace | null>(null);
  readonly review = computed(() => this.workspace()?.review ?? null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly dirty = signal(false);
  readonly conflict = signal(false);
  readonly pending = signal<Pending | null>(null);
  readonly frozen = signal(false);
  readonly blocked = computed(
    () =>
      this.frozen() ||
      this.busy() ||
      this.conflict() ||
      !!this.workspace()?.readOnly ||
      !!this.pending(),
  );
  readonly confirmedProducts = computed(() => [
    ...new Set(
      this.review()
        ?.links.filter((l) => l.confirmed && l.productId)
        .map((l) => l.productId!) ?? [],
    ),
  ]);
  readonly ready = computed(
    () => !!this.review()?.reviewedHash && !this.dirty() && !this.busy() && !this.pending(),
  );
  readonly canAccept = computed(() => {
    const r = this.review();
    return (
      !!r &&
      !this.dirty() &&
      !this.blocked() &&
      r.links.every((l) => l.confirmed) &&
      r.profiles.every((p) => p.aliases.every((a) => a.decision !== 'pending')) &&
      r.unlinkedPassages.every((p) =>
        r.acknowledgedUnlinkedPassages.some((a) => this.key(a) === this.key(p)),
      ) &&
      (this.workspace()?.kind === 'product-card'
        ? this.confirmedProducts().length === 1
        : this.confirmedProducts().length > 0 || r.emptyKnowledgeAcknowledged)
    );
  });
  constructor() {
    effect(() => {
      const s = this.session.state();
      const w = this.context?.workspace();
      const scope =
        s.status === 'READY'
          ? `${s.membership.userId}:${s.membership.businessId}:${s.membership.role}:${w?.kind ?? 'HQ'}`
          : s.status;
      if (scope === this.scope) return;
      this.scope = scope;
      this.clear();
    });
  }
  clear() {
    this.generation++;
    this.workspace.set(null);
    this.pending.set(null);
    this.dirty.set(false);
    this.conflict.set(false);
    this.error.set('');
    this.busy.set(false);
    this.versionId = '';
  }
  async open(versionId: string): Promise<void> {
    const session = this.session.state();
    if (
      session.status !== 'READY' ||
      session.membership.role !== 'HQ' ||
      this.context?.workspace()?.kind === 'SALON'
    )
      return;
    if (this.versionId === versionId && this.workspace()) return;
    const generation = ++this.generation;
    this.versionId = versionId;
    this.busy.set(true);
    try {
      const data = await this.api.getProductKnowledge(versionId);
      if (generation !== this.generation) return;
      this.workspace.set(data);
      this.conflict.set(false);
      this.dirty.set(false);
      this.error.set('');
    } catch {
      if (generation === this.generation)
        this.error.set('Product review could not be loaded. Retry loading.');
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
  async refresh(): Promise<void> {
    const id = this.versionId;
    this.versionId = '';
    await this.open(id);
  }
  private key(p: KnowledgePassageRef) {
    return JSON.stringify([p.chunkId, p.start, p.end]);
  }
  private edit(change: (r: KnowledgeProductReview) => void): void {
    if (this.blocked()) return;
    this.workspace.update((w) => {
      if (!w) return w;
      const next = structuredClone(w);
      change(next.review);
      next.review.reviewedHash = null;
      return next;
    });
    this.dirty.set(true);
  }
  link(passage: KnowledgePassageRef, productId: string) {
    this.edit((r) => {
      r.links.push({
        id: `draft:${crypto.randomUUID()}`,
        passage,
        productId,
        method: 'hq',
        confirmed: true,
      });
      r.acknowledgedUnlinkedPassages = [];
    });
  }
  changeLink(id: string, productId: string, confirmed: boolean) {
    this.edit((r) => {
      const l = r.links.find((l) => l.id === id);
      if (l) {
        l.productId = productId || null;
        l.confirmed = confirmed && !!productId;
      }
      const supported = new Set(
        r.links.filter((link) => link.confirmed).map((link) => link.productId),
      );
      r.profiles = r.profiles.filter((profile) => supported.has(profile.productId));
      r.acknowledgedUnlinkedPassages = [];
    });
  }
  removeLink(id: string) {
    this.edit((r) => {
      r.links = r.links.filter((l) => l.id !== id);
      const ids = new Set(r.links.filter((l) => l.confirmed).map((l) => l.productId));
      r.profiles = r.profiles.filter((p) => ids.has(p.productId));
      r.acknowledgedUnlinkedPassages = [];
    });
  }
  private profile(r: KnowledgeProductReview, id: string): ProductProfileProposal {
    let p = r.profiles.find((p) => p.productId === id);
    if (!p) {
      p = { productId: id, type: null, aliases: [] };
      r.profiles.push(p);
    }
    return p;
  }
  setType(id: string, type: string) {
    this.edit((r) => {
      this.profile(r, id).type = type.trim() || null;
    });
  }
  addAlias(id: string) {
    this.edit((r) => {
      this.profile(r, id).aliases.push({
        id: `draft:${crypto.randomUUID()}`,
        productId: id,
        phrase: '',
        kind: 'name',
        lang: 'pl',
        source: 'hq',
        decision: 'pending',
      });
    });
  }
  editAlias(
    id: string,
    aliasId: string,
    patch: Partial<Pick<AliasProposal, 'phrase' | 'kind' | 'lang' | 'decision'>>,
  ) {
    this.edit((r) => {
      const a = this.profile(r, id).aliases.find((a) => a.id === aliasId);
      if (a) Object.assign(a, patch);
    });
  }
  acknowledge(ref: KnowledgePassageRef, checked: boolean) {
    this.edit((r) => {
      r.acknowledgedUnlinkedPassages = r.acknowledgedUnlinkedPassages.filter(
        (p) => this.key(p) !== this.key(ref),
      );
      if (checked) r.acknowledgedUnlinkedPassages.push(ref);
    });
  }
  acknowledgeEmpty(value: boolean) {
    this.edit((r) => (r.emptyKnowledgeAcknowledged = value));
  }
  async save() {
    const r = this.review();
    if (!r || this.blocked()) return;
    await this.execute({
      action: 'save',
      input: {
        versionId: r.versionId,
        extractionHash: r.extractionHash,
        expectedReviewRevision: r.revision,
        idempotencyKey: crypto.randomUUID(),
        links: r.links.map((l) => ({
          ...(!l.id.startsWith('draft:') ? { id: l.id } : {}),
          passage: l.passage,
          productId: l.productId,
          confirmed: l.confirmed,
        })),
        profiles: r.profiles.map((p) => ({
          productId: p.productId,
          type: p.type,
          aliases: p.aliases.map((a) => ({
            ...(!a.id.startsWith('draft:') ? { id: a.id } : {}),
            phrase: a.phrase,
            kind: a.kind,
            lang: a.lang,
            decision: a.decision,
          })),
        })),
        acknowledgedUnlinkedPassages: r.acknowledgedUnlinkedPassages,
        emptyKnowledgeAcknowledged: r.emptyKnowledgeAcknowledged,
      },
    });
  }
  async accept() {
    const r = this.review();
    if (!r || !this.canAccept()) return;
    await this.execute({
      action: 'accept',
      input: {
        versionId: r.versionId,
        extractionHash: r.extractionHash,
        expectedReviewRevision: r.revision,
        expectedCatalogRevision: r.catalogRevision,
        idempotencyKey: crypto.randomUUID(),
      },
    });
  }
  async generate(productId: string) {
    const r = this.review();
    if (!r || this.blocked() || this.dirty()) return;
    await this.execute({
      action: 'generate',
      input: {
        versionId: r.versionId,
        extractionHash: r.extractionHash,
        expectedReviewRevision: r.revision,
        productId,
        idempotencyKey: crypto.randomUUID(),
      },
    });
  }
  async suggest(passage: KnowledgePassageRef) {
    const r = this.review();
    if (!r || this.blocked() || this.dirty()) return;
    await this.execute({
      action: 'suggest',
      input: {
        versionId: r.versionId,
        extractionHash: r.extractionHash,
        expectedReviewRevision: r.revision,
        passage,
        idempotencyKey: crypto.randomUUID(),
      },
    });
  }
  async retry() {
    const p = this.pending();
    if (p && !this.busy()) await this.execute(p);
  }
  private async execute(command: Pending) {
    const generation = this.generation;
    this.pending.set(command);
    this.busy.set(true);
    this.error.set('');
    try {
      const result = await (command.action === 'save'
        ? this.api.saveKnowledgeProductReview(command.input)
        : command.action === 'accept'
          ? this.api.acceptKnowledgeProductReview(command.input)
          : command.action === 'suggest'
            ? this.api.suggestKnowledgeProductLink(command.input)
            : this.api.generateKnowledgeProductAliases(command.input));
      if (generation !== this.generation) return;
      this.workspace.update((w) => (w ? { ...w, review: result } : w));
      this.dirty.set(false);
      this.pending.set(null);
    } catch (error) {
      if (generation !== this.generation) return;
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      if (!['OUTCOME_UNKNOWN', 'IN_PROGRESS', 'TIMEOUT'].includes(code)) this.pending.set(null);
      if (code === 'STALE_STATE') {
        try {
          const fresh = await this.api.getProductKnowledge(command.input.versionId);
          if (generation !== this.generation) return;
          const local = this.workspace();
          const sameBase =
            local?.review.revision === fresh.review.revision &&
            local?.review.extractionHash === fresh.review.extractionHash;
          if (local && sameBase) {
            this.workspace.set({
              ...fresh,
              review: {
                ...local.review,
                catalogRevision: fresh.review.catalogRevision,
                impact: fresh.review.impact,
                reviewedHash: null,
              },
            });
            this.error.set(
              'The catalog changed. Your edits are preserved. Save draft again to refresh impact, then review it before accepting.',
            );
          } else {
            this.conflict.set(true);
            this.error.set(
              'Another review changed. Your local edits are preserved. Reload the latest product review to discard these local edits deliberately.',
            );
          }
        } catch {
          if (generation !== this.generation) return;
          this.conflict.set(true);
          this.error.set(
            'The latest review could not be loaded. Your local edits are preserved. Retry Reload to discard them only after the latest review loads.',
          );
        }
      } else
        this.error.set(
          command.action === 'generate'
            ? 'Generation is unavailable. Your draft is preserved; edit manually or retry.'
            : 'The result could not be confirmed. Retry the same action or refresh the review.',
        );
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
}
