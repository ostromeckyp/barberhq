import { createHash, randomUUID } from 'node:crypto';
import type { DataConnect } from 'firebase-admin/data-connect';
import { z } from 'zod';
import type {
  ProductAliasKind,
  ProductAliasRow,
  ProductAliasesResult,
} from '../../../shared/contracts/product-admin.js';
import type { LookupAlias, LookupProduct } from '../../../shared/contracts/product-lookup.js';
import { normalizeProduct } from '../../../shared/product-normalization.js';
import { lookupProducts, normalizeProductForMatch } from '../ai/product-lookup.js';
import { KnowledgeError } from '../knowledge/repository.js';
import { createProductAdminCommands } from './commands.js';
import { parseSaveProductAliases } from './schemas.js';

export const productAliasBounds = Object.freeze({ perProduct: 32 });
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
/** Deterministic product-owned identity; inflected variants and re-adds share one revisioned row. */
export function productAliasId(
  businessId: string,
  productId: string,
  kind: ProductAliasKind,
  phrase: string,
) {
  const key = [businessId, productId, kind, normalizeProductForMatch(phrase)].join('\u0000');
  return `product-hq:${sha256(key).slice(0, 40)}`;
}
const kind = z.enum(['NAME', 'PHONETIC', 'TYPE']);
const aliasRow = z.object({
  id: z.string(),
  phrase: z.string(),
  kind,
  revision: z.number().int(),
  source: z.enum(['HQ', 'SEED', 'DOCUMENT']),
});
const lookupProduct = z.object({
  id: z.string(),
  name: z.string(),
  sourceCode: z.string(),
  type: z.string().nullable(),
  category: z.string(),
  summaryEn: z.string(),
  scentPl: z.string().nullable(),
  keywords: z.array(z.string()),
});
const lookupAlias = z.object({
  id: z.string(),
  productId: z.string(),
  phrase: z.string(),
  normalized: z.string(),
  kind,
  source: z.enum(['GENERATED', 'HQ', 'SEED', 'SALON_CONFIRMED']),
  salonId: z.string().nullable(),
  sourceVersionId: z.string().nullable(),
  ambiguous: z.boolean(),
  revision: z.number().int(),
});
const rows = <T>(schema: z.ZodType<T>, data: unknown) =>
  z.object({ rows: z.array(schema) }).parse(data).rows;

export function createProductAliasCommands(dc: DataConnect) {
  const admin = createProductAdminCommands(dc);
  async function current(uid: string, productId: string): Promise<ProductAliasRow[]> {
    return rows(
      aliasRow,
      (await dc.executeQuery('ReadProductAliases', { uid, productId })).data,
    ).map((r) => ({ ...r, editable: r.source !== 'DOCUMENT' }));
  }
  /** Phrases that, as typed, also resolve to other products at an exact tier. */
  async function collisions(uid: string, productId: string, phrases: string[]) {
    if (!phrases.length) return [];
    const products: LookupProduct[] = rows(
      lookupProduct,
      (await dc.executeQuery('ReadCollisionProducts', { uid })).data,
    ).map((p) => ({ ...p, productId: p.id, productName: p.name }));
    const aliases: LookupAlias[] = rows(
      lookupAlias,
      (await dc.executeQuery('ReadCollisionAliases', { uid })).data,
    );
    return phrases.flatMap((phrase) => {
      const match = lookupProducts(phrase, products, aliases, '');
      const others = match.candidates.filter((c) => c.productId !== productId);
      return ['NAME', 'PHONETIC', 'TYPE'].includes(match.match) && others.length
        ? [{ phrase, productNames: others.map((c) => c.productName) }]
        : [];
    });
  }
  async function list(uid: string, productId: string): Promise<ProductAliasesResult> {
    await admin.read(uid, productId);
    return { aliases: await current(uid, productId), collisions: [] };
  }
  return {
    list,
    collisionsFor: collisions,
    async save(uid: string, raw: unknown): Promise<ProductAliasesResult> {
      const input = parseSaveProductAliases(raw);
      const hash = sha256(JSON.stringify([input.productId, input.changes]));
      const replayed = await admin.replay(uid, input.idempotencyKey, 'ALIASES', hash);
      if (replayed) return list(uid, input.productId);
      const product = await admin.read(uid, input.productId);
      const businessId = product.id.slice(0, product.id.length - product.demoId.length - 1);
      const existing = await current(uid, input.productId);
      const retires: { id: string; expectedRevision: number }[] = [];
      const upserts = new Map<string, { id: string; phrase: string; kind: ProductAliasKind }>();
      const target = (aliasId: string, expectedRevision: number) => {
        const row = existing.find((a) => a.id === aliasId);
        if (row && !row.editable) throw new KnowledgeError('VALIDATION_ERROR');
        if (!row || row.revision !== expectedRevision) throw new KnowledgeError('STALE_STATE');
        return row;
      };
      for (const change of input.changes) {
        if (change.op === 'remove') {
          const row = target(change.aliasId, change.expectedRevision);
          retires.push({ id: row.id, expectedRevision: row.revision });
          continue;
        }
        const id = productAliasId(businessId, input.productId, change.kind, change.phrase);
        if (change.op === 'edit') {
          const row = target(change.aliasId, change.expectedRevision);
          if (row.id !== id) retires.push({ id: row.id, expectedRevision: row.revision });
        }
        upserts.set(id, { id, phrase: change.phrase, kind: change.kind });
      }
      const revisions = new Map(
        rows(
          z.object({ id: z.string(), revision: z.number().int(), status: z.string() }),
          (
            await dc.executeQuery('ReadProductAliasRevisions', {
              uid,
              productId: input.productId,
              idsJson: JSON.stringify([...upserts.keys()]),
            })
          ).data,
        ).map((r) => [r.id, r]),
      );
      const writes = [...upserts.values()]
        .filter((u) => {
          const r = revisions.get(u.id);
          const same = existing.find((a) => a.id === u.id);
          return !(r?.status === 'ACTIVE' && same?.phrase === u.phrase && same.kind === u.kind);
        })
        .map((u) => ({
          ...u,
          normalized: normalizeProduct(u.phrase),
          expectedRevision: revisions.get(u.id)?.revision ?? 0,
        }));
      const activeHq = existing.filter((a) => a.source === 'HQ').length;
      const retiredHq = retires.filter((r) => existing.find((a) => a.id === r.id)?.source === 'HQ');
      const added = writes.filter((w) => revisions.get(w.id)?.status !== 'ACTIVE').length;
      if (activeHq - retiredHq.length + added > productAliasBounds.perProduct)
        throw new KnowledgeError('VALIDATION_ERROR');
      if (retires.length || writes.length)
        try {
          await dc.executeMutation('SaveProductAliases', {
            uid,
            productId: input.productId,
            retiresJson: JSON.stringify(retires),
            upsertsJson: JSON.stringify(writes),
            operationId: randomUUID(),
            key: input.idempotencyKey,
            payloadHash: hash,
          });
        } catch {
          if (!(await admin.replay(uid, input.idempotencyKey, 'ALIASES', hash)))
            throw new KnowledgeError('STALE_STATE');
        }
      return {
        aliases: await current(uid, input.productId),
        collisions: await collisions(
          uid,
          input.productId,
          [...upserts.values()].map((u) => u.phrase),
        ),
      };
    },
  };
}
export type ProductAliasCommands = ReturnType<typeof createProductAliasCommands>;
