import { randomUUID } from 'node:crypto';
import type {
  KnowledgeProductReview,
  GenerateKnowledgeProductAliasesInput,
  SuggestKnowledgeProductLinkInput,
} from '../../../shared/contracts/product-knowledge/index.js';
import { normalizeProduct } from '../../../shared/product-normalization.js';
import {
  ProductKnowledgeCommands,
  assertProductDraft,
  productOperationHash,
  reviewFromState,
} from './product-knowledge-commands.js';
import type {
  KnowledgeAliasRow,
  ProductKnowledgeState,
  ProductOperation,
} from './product-knowledge-repository.js';
import { KnowledgeError } from './repository.js';
import { createAiBudget, consumeToolCall, runWithinBudget, type AiBudget } from '../ai/budget.js';
import type { createAiAdmission } from '../ai/admission.js';
import {
  parseGenerateKnowledgeProductAliases,
  parseSuggestKnowledgeProductLink,
  parseProductAliasGeneration,
  parseProductLinkSuggestion,
} from './product-knowledge-schemas.js';
import {
  resolveKnowledgePassage,
  suggestProductCodeLinks,
  passageKey,
} from './product-knowledge-rules.js';
import { productKnowledgePrompt } from './product-knowledge-model.js';
export type KnowledgeGenerationProvider = (
  budget: AiBudget,
  prompt: string,
  kind: 'aliases' | 'link',
) => Promise<unknown>;
export class ProductKnowledgeGeneration {
  constructor(
    private readonly commands: ProductKnowledgeCommands,
    private readonly admission: ReturnType<typeof createAiAdmission>,
    private readonly provider: KnowledgeGenerationProvider,
    private readonly clock: () => number = Date.now,
  ) {}
  async suggestLink(
    uid: string,
    raw: SuggestKnowledgeProductLinkInput,
  ): Promise<KnowledgeProductReview> {
    return this.run(uid, parseSuggestKnowledgeProductLink(raw), 'link');
  }
  async generateAliases(
    uid: string,
    raw: GenerateKnowledgeProductAliasesInput,
  ): Promise<KnowledgeProductReview> {
    return this.run(uid, parseGenerateKnowledgeProductAliases(raw), 'aliases');
  }
  private async run(
    uid: string,
    input: SuggestKnowledgeProductLinkInput | GenerateKnowledgeProductAliasesInput,
    kind: 'link' | 'aliases',
  ): Promise<KnowledgeProductReview> {
    const budget = createAiBudget(this.clock(), this.clock);
    const actor = await runWithinBudget(budget, () => this.admission.resolveActor(uid));
    if (actor.role !== 'HQ') throw new KnowledgeError('FORBIDDEN');
    const action = kind === 'link' ? 'SUGGEST' : 'GENERATE';
    const hash = productOperationHash(action, input);
    const repo = this.commands.products;
    consumeToolCall(budget);
    const state = await repo.state(uid, input.versionId, input.idempotencyKey, budget);
    if (state.businessId !== actor.businessId) throw new KnowledgeError('FORBIDDEN');
    const op = state.operation;
    if (op) {
      if (op.action !== action || op.payload_hash !== hash)
        throw new KnowledgeError('IDEMPOTENCY_CONFLICT');
      if (op.completed_at && op.result) return op.result;
      if (op.lease_expires_at && Date.parse(op.lease_expires_at) > this.clock())
        throw new KnowledgeError('IN_PROGRESS');
    }
    assertProductDraft(state, input.extractionHash, input.expectedReviewRevision);
    const catalog = await repo.catalog(uid, input.versionId, budget);
    const active = await repo.activeAliases(uid, input.versionId, budget);
    if (JSON.stringify({ catalog, aliases: active }).length > 64000)
      throw new KnowledgeError('VALIDATION_ERROR', 'Catalog input limit exceeded');
    const current = reviewFromState(state);
    let facts: string[];
    let codeIds: string[] | undefined;
    if ('passage' in input) {
      const source = resolveKnowledgePassage(input.passage, state.chunks);
      facts = [source.text];
      codeIds = suggestProductCodeLinks([{ ref: input.passage, ...source }], catalog)[0]
        ?.productIds;
    } else {
      const links = current.links.filter((l) => l.confirmed && l.productId === input.productId);
      if (!links.length || !catalog.some((p) => p.id === input.productId))
        throw new KnowledgeError(
          'VALIDATION_ERROR',
          'Confirm the product passage before generation',
        );
      facts = links.map((l) => resolveKnowledgePassage(l.passage, state.chunks).text);
    }
    const prompt = productKnowledgePrompt(
      kind,
      facts,
      kind === 'aliases'
        ? catalog.map((p) => ({
            ...p,
            target: p.id === ('productId' in input ? input.productId : undefined),
          }))
        : catalog,
      active,
    );
    const generationId = randomUUID();
    const now = new Date(this.clock()).toISOString();
    const operation: ProductOperation = {
      id: op?.id ?? randomUUID(),
      business_id: state.businessId,
      version_id: state.versionId,
      actor_uid: uid,
      idempotency_key: input.idempotencyKey,
      action,
      payload_hash: hash,
      result: null,
      generation_id: generationId,
      lease_expires_at: new Date(budget.deadlineMs).toISOString(),
      completed_at: null,
      created_at: op?.created_at ?? now,
    };
    consumeToolCall(budget);
    try {
      await runWithinBudget(budget, () =>
        repo.claim({
          uid,
          businessId: state.businessId,
          versionId: state.versionId,
          revision: state.revision,
          catalogRevision: state.catalogRevision,
          extractionHash: input.extractionHash,
          operationJson: JSON.stringify([operation]),
          leaseSeconds: Math.max(1, Math.ceil((budget.deadlineMs - this.clock()) / 1000)),
        }),
      );
    } catch {
      const fresh = await repo.state(uid, input.versionId, input.idempotencyKey, budget);
      if (fresh.operation) {
        if (fresh.operation.payload_hash !== hash || fresh.operation.action !== action)
          throw new KnowledgeError('IDEMPOTENCY_CONFLICT');
        if (fresh.operation.completed_at && fresh.operation.result) return fresh.operation.result;
        throw new KnowledgeError('IN_PROGRESS');
      }
      throw new KnowledgeError('STALE_STATE');
    }
    try {
      let output: unknown;
      if (codeIds) output = { productIds: codeIds };
      else {
        const admitted = await this.admission.admitAiCall(
          actor,
          'product-knowledge',
          JSON.stringify({ action, versionId: input.versionId, hash }),
          new Date(),
        );
        budget.deadlineMs = Math.min(budget.deadlineMs, admitted.deadlineMs);
        output = await runWithinBudget(budget, () => this.provider(budget, prompt, kind));
      }
      consumeToolCall(budget);
      const fresh = await repo.state(uid, input.versionId, input.idempotencyKey, budget);
      assertProductDraft(fresh, input.extractionHash, input.expectedReviewRevision);
      if (
        fresh.businessId !== actor.businessId ||
        fresh.catalogRevision !== state.catalogRevision ||
        fresh.operation?.generation_id !== generationId ||
        fresh.operation.completed_at
      )
        throw new KnowledgeError('STALE_STATE');
      const next: ProductKnowledgeState = {
        ...fresh,
        revision: fresh.revision + 1,
        reviewedHash: null,
        links: [...fresh.links],
        profiles: [...fresh.profiles],
        aliases: [...fresh.aliases],
        state: { acknowledgedUnlinkedPassages: [], emptyKnowledgeAcknowledged: false },
      };
      if ('passage' in input) {
        const ids = codeIds ?? parseProductLinkSuggestion(output).productIds;
        if (ids.some((id) => !catalog.some((p) => p.id === id)))
          throw new KnowledgeError('VALIDATION_ERROR', 'Suggestion selected a foreign product');
        const old = next.links.find(
          (l) =>
            passageKey({ chunkId: l.chunk_id, start: l.start, end: l.end }) ===
            passageKey(input.passage),
        );
        if (old?.confirmed)
          throw new KnowledgeError('VALIDATION_ERROR', 'A confirmed passage is edited manually');
        const link = {
          id: old?.id ?? randomUUID(),
          version_id: state.versionId,
          business_id: state.businessId,
          product_id: null,
          chunk_id: input.passage.chunkId,
          start: input.passage.start,
          end: input.passage.end,
          extraction_hash: input.extractionHash,
          candidate_product_ids: ids,
          method: codeIds ? ('code' as const) : ('model' as const),
          confirmed: false,
          created_by: uid,
          created_at: now,
        };
        next.links = next.links.filter((l) => l.id !== old?.id);
        next.links.push(link);
        if (next.links.length > 200)
          throw new KnowledgeError('VALIDATION_ERROR', 'Passage limit exceeded');
      } else {
        const generated = parseProductAliasGeneration(output);
        const existing = next.profiles.find((p) => p.product_id === input.productId);
        if (!existing)
          next.profiles.push({
            version_id: state.versionId,
            business_id: state.businessId,
            product_id: input.productId,
            proposed_type: generated.type,
            approved_type: null,
            reviewed_by: null,
            reviewed_at: null,
          });
        const identities = new Set(
          next.aliases
            .filter((a) => a.product_id === input.productId)
            .map((a) => JSON.stringify([a.normalized, a.kind, a.lang])),
        );
        for (const alias of generated.aliases) {
          const normalized = normalizeProduct(alias.phrase);
          const identity = JSON.stringify([normalized, alias.kind.toUpperCase(), alias.lang]);
          if (identities.has(identity)) continue;
          identities.add(identity);
          next.aliases.push({
            id: randomUUID(),
            business_id: state.businessId,
            product_id: input.productId,
            salon_id: null,
            phrase: alias.phrase,
            normalized,
            kind: alias.kind.toUpperCase() as KnowledgeAliasRow['kind'],
            lang: alias.lang,
            source: 'GENERATED',
            status: 'PROPOSED',
            ambiguous: false,
            source_document_version_id: state.versionId,
            created_by: uid,
            created_at: now,
            reviewed_by: null,
            reviewed_at: null,
            generation_id: generationId,
          });
        }
        if (next.aliases.filter((a) => a.product_id === input.productId).length > 32)
          throw new KnowledgeError('VALIDATION_ERROR', 'Alias proposal limit exceeded');
      }
      consumeToolCall(budget);
      return await runWithinBudget(budget, () =>
        this.commands.persistGenerated(
          uid,
          fresh,
          next,
          action,
          input.idempotencyKey,
          hash,
          generationId,
          budget,
        ),
      );
    } finally {
      await runWithinBudget(budget, () => repo.release(uid, generationId)).catch(() => {});
    }
  }
}
