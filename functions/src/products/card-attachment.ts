import { createHash } from 'node:crypto';
import type { DataConnect } from 'firebase-admin/data-connect';
import { z } from 'zod';
import type { ProductAliasKind } from '../../../shared/contracts/product-admin/index.js';
import type { DocumentCommandService } from '../knowledge/document-commands.js';
import type { ProductKnowledgeCommands } from '../product-knowledge/commands.js';
import type { ProductKnowledgeGeneration } from '../product-knowledge/generation.js';
import { KnowledgeError, type KnowledgeRepository } from '../knowledge/repository.js';
import type { ReviewPublishService } from '../knowledge/review-publish.js';
import { normalizeProductForMatch } from '../ai/product-lookup.js';
import { createProductAliasCommands } from './aliases.js';
import { createProductAdminCommands } from './commands.js';
import type { CardStatus } from './models/card-status.js';
import type { CardSuggestion } from './models/card-suggestion.js';
import type { CardAttachmentState } from './models/card-attachment-state.js';

type Deps = {
  dc: DataConnect;
  repo: KnowledgeRepository;
  documents: DocumentCommandService;
  products: ProductKnowledgeCommands;
  generation: ProductKnowledgeGeneration;
  /** Required only to process (publish) a card. */
  review?: ReviewPublishService;
};
const attachmentRow = z.object({
  documentId: z.string(),
  versionId: z.string(),
  status: z.string(),
  suggestions: z.array(
    z.object({
      phrase: z.string(),
      kind: z.enum(['NAME', 'PHONETIC', 'TYPE']),
      collisions: z.array(z.string()),
    }),
  ),
  revision: z.number().int(),
  documentRevision: z.number().int().nullable(),
  staleGenerating: z.boolean(),
});
const key = z.object({ productId: z.string().min(1).max(200), idempotencyKey: z.string().uuid() });
const attachInput = key.extend({ sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const processInput = key.extend({ versionId: z.string().min(1).max(300) }).strict();
function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const r = schema.safeParse(raw);
  if (!r.success) throw new KnowledgeError('VALIDATION_ERROR');
  return r.data;
}
/** Deterministic per-step keys so a retried process replays each underlying command. */
function stepKey(base: string, step: string) {
  const h = createHash('sha256').update(`${base}\u0000${step}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/**
 * A card attached on the product screen: the existing upload/extraction pipeline, one model call
 * for alias suggestions, and background publication carrying only a whole-card product link.
 */
export function createProductCardService(deps: Deps) {
  const admin = createProductAdminCommands(deps.dc);
  const aliases = createProductAliasCommands(deps.dc);
  async function attachment(uid: string, productId: string) {
    await admin.read(uid, productId);
    const rows = z
      .object({ rows: z.array(attachmentRow) })
      .parse(
        (await deps.dc.executeQuery('ReadProductCardAttachment', { uid, productId })).data,
      ).rows;
    return rows[0] ?? null;
  }
  async function write(
    uid: string,
    productId: string,
    expectedRevision: number,
    state: Omit<CardAttachmentState, 'suggestions'> & { suggestions?: CardSuggestion[] },
  ) {
    await deps.dc.executeMutation('SaveProductCardAttachment', {
      uid,
      productId,
      expectedRevision,
      documentId: state.documentId,
      versionId: state.versionId,
      status: state.status,
      suggestionsJson: JSON.stringify(state.suggestions ?? []),
    });
  }
  async function state(uid: string, productId: string): Promise<CardAttachmentState> {
    const row = await attachment(uid, productId);
    if (!row) throw new KnowledgeError('NOT_FOUND');
    const version = await deps.repo.version(row.versionId);
    const status = version?.publishedAt ? 'PUBLISHED' : (row.status as CardStatus);
    return {
      documentId: row.documentId,
      versionId: row.versionId,
      status,
      suggestions: row.suggestions,
    };
  }
  return {
    state,
    async attach(uid: string, raw: unknown): Promise<CardAttachmentState> {
      const input = parse(attachInput, raw);
      const product = await admin.read(uid, input.productId);
      const current = await attachment(uid, input.productId);
      const created = await deps.documents.create(uid, {
        title: `${product.form.name} — karta produktu`,
        language: 'pl',
        kind: 'product-card',
        origin: 'public-compilation',
        sourceUrls: [product.form.sourceUrl],
        observedOn: product.form.observedOn,
        sha256: input.sha256,
        idempotencyKey: input.idempotencyKey,
        ...(current?.documentRevision != null
          ? { documentId: current.documentId, expectedDocumentRevision: current.documentRevision }
          : {}),
      });
      const next = {
        documentId: created.documentId,
        versionId: created.versionId,
        status: 'UPLOADING' as const,
      };
      if (current?.versionId !== created.versionId)
        await write(uid, input.productId, current?.revision ?? 0, next);
      return state(uid, input.productId);
    },
    async process(uid: string, raw: unknown): Promise<CardAttachmentState> {
      const input = parse(processInput, raw);
      const row = await attachment(uid, input.productId);
      if (!row || row.versionId !== input.versionId) throw new KnowledgeError('STALE_STATE');
      // A stale GENERATING (crashed or timed-out attempt) may resume: every step replays by key.
      const resumable =
        ['UPLOADING', 'FAILED'].includes(row.status) ||
        (row.status === 'GENERATING' && row.staleGenerating);
      if (!resumable) return state(uid, input.productId);
      const version = await deps.repo.version(input.versionId);
      const base = { documentId: row.documentId, versionId: row.versionId };
      // Extraction outcomes the card cannot proceed from are terminal, not "in progress".
      if (version?.status === 'FAILED' || version?.revokedAt) {
        await write(uid, input.productId, row.revision, { ...base, status: 'FAILED' });
        return state(uid, input.productId);
      }
      if (
        version?.status === 'NEEDS_REVIEW' ||
        (version?.extractionHash && !version.chunks.length)
      ) {
        await write(uid, input.productId, row.revision, { ...base, status: 'NEEDS_REVIEW' });
        return state(uid, input.productId);
      }
      if (!version?.extractionHash || !['EXTRACTED', 'REVIEWED', 'READY'].includes(version.status))
        throw new KnowledgeError('IN_PROGRESS');
      await write(uid, input.productId, row.revision, { ...base, status: 'GENERATING' });
      try {
        const chunk = version.chunks[0];
        const link = {
          passage: { chunkId: chunk.id, start: 0, end: chunk.text.length },
          productId: input.productId,
          confirmed: true,
        };
        const first = await deps.products.save(uid, {
          versionId: version.id,
          extractionHash: version.extractionHash,
          expectedReviewRevision: version.productKnowledgeRevision ?? 0,
          idempotencyKey: stepKey(input.versionId, 'link'),
          links: [link],
          profiles: [],
          acknowledgedUnlinkedPassages: [],
          emptyKnowledgeAcknowledged: false,
        });
        const generated = await deps.generation.generateAliases(uid, {
          versionId: version.id,
          extractionHash: version.extractionHash,
          expectedReviewRevision: first.revision,
          productId: input.productId,
          idempotencyKey: stepKey(input.versionId, 'generate'),
        });
        const proposals =
          generated.profiles.find((p) => p.productId === input.productId)?.aliases ?? [];
        // Aliases belong to the product: the published card carries the link only.
        const linkOnly = await deps.products.save(uid, {
          versionId: version.id,
          extractionHash: version.extractionHash,
          expectedReviewRevision: generated.revision,
          idempotencyKey: stepKey(input.versionId, 'link-only'),
          links: [link],
          profiles: [],
          acknowledgedUnlinkedPassages: generated.unlinkedPassages,
          emptyKnowledgeAcknowledged: false,
        });
        const accepted = await deps.products.accept(uid, {
          versionId: version.id,
          extractionHash: version.extractionHash,
          expectedReviewRevision: linkOnly.revision,
          expectedCatalogRevision: linkOnly.catalogRevision,
          idempotencyKey: stepKey(input.versionId, 'accept'),
        });
        const own = new Set(
          (await aliases.list(uid, input.productId)).aliases.map((a) =>
            normalizeProductForMatch(a.phrase),
          ),
        );
        const fresh = proposals
          .map((p) => ({ phrase: p.phrase.trim(), kind: p.kind.toUpperCase() as ProductAliasKind }))
          .filter(
            (p, i, all) =>
              p.phrase &&
              !own.has(normalizeProductForMatch(p.phrase)) &&
              all.findIndex((o) => o.phrase === p.phrase) === i,
          );
        const collisions = await aliases.collisionsFor(
          uid,
          input.productId,
          fresh.map((p) => p.phrase),
        );
        const suggestions = fresh.map((p) => ({
          ...p,
          collisions: collisions.find((c) => c.phrase === p.phrase)?.productNames ?? [],
        }));
        const clean =
          version.pages.length > 0 && version.pages.every((p) => p.quality === 'COMPLETE');
        if (clean) {
          if (!deps.review) throw new KnowledgeError('INVALID_CONFIG');
          await deps.review.reviewAndPublishDocument(uid, {
            versionId: version.id,
            extractionHash: version.extractionHash,
            reviewedPhysicalPages: version.pages.map((p) => p.physicalPage),
            expectedDocumentRevision: version.document.revision,
            idempotencyKey: stepKey(input.versionId, 'publish'),
            productKnowledgeReviewedHash: accepted.reviewedHash!,
          });
        }
        await write(uid, input.productId, row.revision + 1, {
          ...base,
          status: clean ? 'PUBLISHING' : 'NEEDS_REVIEW',
          suggestions,
        });
      } catch (error) {
        const latest = await attachment(uid, input.productId);
        if (latest?.versionId === input.versionId)
          await write(uid, input.productId, latest.revision, { ...base, status: 'FAILED' });
        throw error;
      }
      return state(uid, input.productId);
    },
  };
}
