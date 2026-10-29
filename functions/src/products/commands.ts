import { createHash, randomUUID } from 'node:crypto';
import type { DataConnect } from 'firebase-admin/data-connect';
import { z } from 'zod';
import type {
  CreateProductInput,
  HqStock,
  ProductCategory,
  ProductDetail,
  SetHqStockInput,
  UpdateProductInput,
} from '../../../shared/contracts/product-admin.js';
import { KnowledgeError } from '../knowledge/repository.js';
import { parseCreateProduct, parseSetHqStock, parseUpdateProduct } from './schemas.js';

const sha256 = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const detailRow = z.object({
  id: z.string(),
  demoId: z.string(),
  name: z.string(),
  brand: z.string(),
  category: z.string(),
  type: z.string().nullable(),
  summary: z.string(),
  scent: z.string().nullable(),
  netContentMl: z.number().int(),
  retailPriceGrosz: z.number().int(),
  sourceCode: z.string(),
  sourceUrl: z.string(),
  observedOn: z.string(),
  onHand: z.number().int(),
  reserved: z.number().int(),
  version: z.number().int(),
  revision: z.number().int(),
  catalogRevision: z.number().int(),
});
const operation = z.object({
  productAdminOperations: z.array(
    z.object({
      action: z.string(),
      payloadHash: z.string(),
      result: z.object({ productId: z.string() }),
    }),
  ),
});

/**
 * Readable identity fixed at creation. The creation key keeps it unique even when a code is
 * later renamed and then reused by another product.
 */
export function productDemoId(sourceCode: string, creationKey: string): string {
  const slug = sourceCode
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  return `HQ-${slug || 'PRODUCT'}-${sha256(creationKey).slice(0, 8).toUpperCase()}`;
}

export function createProductAdminCommands(dc: DataConnect) {
  async function read(uid: string, productId: string): Promise<ProductDetail> {
    const rows = z
      .object({ rows: z.array(detailRow) })
      .parse((await dc.executeQuery('ReadProductAdmin', { uid, productId })).data).rows;
    if (!rows.length) throw new KnowledgeError('FORBIDDEN');
    const r = rows[0];
    return {
      id: r.id,
      demoId: r.demoId,
      form: {
        name: r.name,
        brand: r.brand,
        // A category outside the list shows unselected; HQ must pick one before saving.
        category: r.category as ProductCategory,
        type: r.type,
        summary: r.summary,
        scent: r.scent,
        netContentMl: r.netContentMl,
        retailPriceGrosz: r.retailPriceGrosz,
        sourceCode: r.sourceCode,
        sourceUrl: r.sourceUrl,
        observedOn: r.observedOn,
      },
      hq: hqStock(r.onHand, r.reserved, r.version),
      revision: r.revision,
      catalogRevision: r.catalogRevision,
    };
  }
  const hqStock = (onHand: number, reserved: number, version: number): HqStock => ({
    onHand,
    reserved,
    available: onHand - reserved,
    version,
  });
  /** A completed operation with the same key returns its product; a different payload is rejected. */
  async function replay(uid: string, key: string, action: string, hash: string) {
    const ops = operation.parse(
      (await dc.executeQuery('ReadProductAdminOperation', { uid, key })).data,
    ).productAdminOperations;
    if (!ops.length) return null;
    if (ops[0].action !== action || ops[0].payloadHash !== hash)
      throw new KnowledgeError('VALIDATION_ERROR');
    return ops[0].result.productId;
  }
  async function hqBusiness(uid: string): Promise<string> {
    const { membership } = z
      .object({ membership: z.object({ role: z.string(), businessId: z.string() }).nullable() })
      .parse((await dc.executeQuery('ReadProductAdminScope', { uid })).data);
    if (membership?.role !== 'HQ') throw new KnowledgeError('FORBIDDEN');
    return membership.businessId;
  }
  async function codeTaken(uid: string, sourceCode: string, productId?: string) {
    const rows = z
      .object({ rows: z.array(z.object({ id: z.string() })) })
      .parse((await dc.executeQuery('ReadProductCodeOwner', { uid, sourceCode })).data).rows;
    return rows.some((r) => r.id !== productId);
  }
  /** After a failed write: a journaled outcome wins, otherwise scope, otherwise stale. */
  async function resolveFailure(
    uid: string,
    key: string,
    action: string,
    hash: string,
    productId?: string,
  ) {
    const done = await replay(uid, key, action, hash);
    if (done) return done;
    if (productId) await read(uid, productId);
    throw new KnowledgeError('STALE_STATE');
  }
  return {
    read,
    replay,
    async create(uid: string, raw: unknown): Promise<ProductDetail> {
      const input: CreateProductInput = parseCreateProduct(raw);
      const hash = sha256({ form: input.form, hqOnHand: input.hqOnHand });
      const done = await replay(uid, input.idempotencyKey, 'CREATE', hash);
      if (done) return read(uid, done);
      const businessId = await hqBusiness(uid);
      if (await codeTaken(uid, input.form.sourceCode)) throw new KnowledgeError('VALIDATION_ERROR');
      const demoId = productDemoId(input.form.sourceCode, input.idempotencyKey);
      const productId = `${businessId}:${demoId}`;
      try {
        await dc.executeMutation('CreateProductAdmin', {
          uid,
          productId,
          demoId,
          formJson: JSON.stringify(input.form),
          hqOnHand: input.hqOnHand,
          operationId: randomUUID(),
          key: input.idempotencyKey,
          payloadHash: hash,
        });
      } catch {
        return read(uid, await resolveFailure(uid, input.idempotencyKey, 'CREATE', hash));
      }
      return read(uid, productId);
    },
    async update(uid: string, raw: unknown): Promise<ProductDetail> {
      const input: UpdateProductInput = parseUpdateProduct(raw);
      const hash = sha256({
        productId: input.productId,
        rev: input.expectedRevision,
        form: input.form,
      });
      const done = await replay(uid, input.idempotencyKey, 'UPDATE', hash);
      if (done) return read(uid, done);
      const current = await read(uid, input.productId);
      if (current.revision !== input.expectedRevision) throw new KnowledgeError('STALE_STATE');
      if (await codeTaken(uid, input.form.sourceCode, input.productId))
        throw new KnowledgeError('VALIDATION_ERROR');
      try {
        await dc.executeMutation('UpdateProductAdmin', {
          uid,
          productId: input.productId,
          expectedRevision: input.expectedRevision,
          formJson: JSON.stringify(input.form),
          operationId: randomUUID(),
          key: input.idempotencyKey,
          payloadHash: hash,
        });
      } catch {
        await resolveFailure(uid, input.idempotencyKey, 'UPDATE', hash, input.productId);
      }
      return read(uid, input.productId);
    },
    async setHqStock(uid: string, raw: unknown): Promise<HqStock> {
      const input: SetHqStockInput = parseSetHqStock(raw);
      const hash = sha256({
        productId: input.productId,
        v: input.expectedVersion,
        onHand: input.onHand,
      });
      const done = await replay(uid, input.idempotencyKey, 'SET_HQ_STOCK', hash);
      if (done) return (await read(uid, done)).hq;
      const current = (await read(uid, input.productId)).hq;
      if (current.version !== input.expectedVersion) throw new KnowledgeError('STALE_STATE');
      if (input.onHand < current.reserved) throw new KnowledgeError('VALIDATION_ERROR');
      try {
        await dc.executeMutation('SetHqStockAdmin', {
          uid,
          productId: input.productId,
          expectedVersion: input.expectedVersion,
          onHand: input.onHand,
          operationId: randomUUID(),
          key: input.idempotencyKey,
          payloadHash: hash,
          adjustmentId: randomUUID(),
        });
      } catch {
        await resolveFailure(uid, input.idempotencyKey, 'SET_HQ_STOCK', hash, input.productId);
      }
      return (await read(uid, input.productId)).hq;
    },
  };
}
export type ProductAdminCommands = ReturnType<typeof createProductAdminCommands>;
