import type { DataConnect } from 'firebase-admin/data-connect';
import { z } from 'genkit';
import type { LookupAlias } from '../../../shared/contracts/product-lookup/index.js';
import type { ActorContext } from './models/actor-context.js';
import { AiError, runWithinBudget } from './budget.js';
import type { AiBudget } from './models/ai-budget.js';
import type { ReplenishmentRepository } from './models/replenishment-repository.js';
import type { ReplenishmentProduct } from './models/replenishment-product.js';

/** Complete snapshot bounds; overflow fails explicitly instead of truncating. */
export const replenishmentBounds = Object.freeze({
  products: 200,
  productPage: 100,
  globalAliases: 5000,
  aliasPage: 1000,
  salonAliases: 200,
});

const header = z.object({
  membership: z.object({
    businessId: z.string(),
    role: z.enum(['HQ', 'SALON']),
    salonAccesses_on_membership: z.array(z.object({ locationId: z.string() })),
  }),
  location: z.object({
    id: z.string(),
    businessId: z.string(),
    kind: z.literal('SALON'),
    productAliasRevision: z.number().int().nonnegative(),
  }),
  business: z.object({ productKnowledgeRevision: z.number().int().nonnegative() }),
});
const inventory = z.object({
  locationId: z.string(),
  kind: z.enum(['HQ', 'SALON']),
  onHand: z.number().int().nonnegative(),
  reserved: z.number().int().nonnegative(),
  version: z.number().int().positive(),
});
const productRow = z.object({
  id: z.string(),
  name: z.string(),
  sourceCode: z.string(),
  type: z.string().nullable(),
  category: z.string(),
  summaryEn: z.string(),
  scentPl: z.string().nullable(),
  keywords: z.array(z.string()),
  inventories: z.array(inventory),
  activeRequestIds: z.array(z.string()),
});
const aliasRow = z.object({
  id: z.string(),
  productId: z.string(),
  phrase: z.string(),
  normalized: z.string(),
  kind: z.enum(['NAME', 'TYPE', 'PHONETIC']),
  source: z.enum(['GENERATED', 'HQ', 'SEED', 'SALON_CONFIRMED']),
  salonId: z.string().nullable(),
  sourceVersionId: z.string().nullable(),
  ambiguous: z.boolean(),
  revision: z.number().int().positive(),
});

export function createReplenishmentRepository(dc: DataConnect): ReplenishmentRepository {
  async function query(name: string, variables: Record<string, unknown>, budget: AiBudget) {
    try {
      return (await runWithinBudget(budget, () => dc.executeQuery(name, variables))).data;
    } catch (error) {
      if (error instanceof AiError) throw error;
      if (error instanceof Error && error.message.includes('FORBIDDEN'))
        throw new AiError('FORBIDDEN');
      throw new AiError('SERVICE_UNAVAILABLE');
    }
  }
  async function rows<T>(
    name: string,
    schema: z.ZodType<T>,
    variables: Record<string, unknown>,
    page: number,
    max: number,
    budget: AiBudget,
  ): Promise<T[]> {
    const out: T[] = [];
    let after = '';
    for (;;) {
      const parsed = z
        .object({ rows: z.array(schema) })
        .safeParse(await query(name, { ...variables, after, limit: page }, budget));
      if (!parsed.success) throw new AiError('SERVICE_UNAVAILABLE');
      out.push(...parsed.data.rows);
      if (out.length > max) throw new AiError('SERVICE_UNAVAILABLE');
      if (parsed.data.rows.length < page) return out;
      after = (parsed.data.rows.at(-1) as { id: string }).id;
    }
  }
  async function readHeader(actor: ActorContext, salonId: string, budget: AiBudget) {
    const parsed = header.safeParse(
      await query(
        'ReadReplenishmentSnapshotHeader',
        { uid: actor.uid, businessId: actor.businessId, role: actor.role, salonId },
        budget,
      ),
    );
    if (!parsed.success) throw new AiError('SERVICE_UNAVAILABLE');
    const data = parsed.data;
    if (
      data.membership.businessId !== actor.businessId ||
      data.membership.role !== actor.role ||
      data.location.id !== salonId ||
      data.location.businessId !== actor.businessId ||
      (actor.role === 'SALON' &&
        !data.membership.salonAccesses_on_membership.some((a) => a.locationId === salonId))
    )
      throw new AiError('FORBIDDEN');
    return {
      catalogRevision: data.business.productKnowledgeRevision,
      salonAliasRevision: data.location.productAliasRevision,
    };
  }
  return {
    async readContext(actor, salonId, budget) {
      const before = await readHeader(actor, salonId, budget);
      const scope = { businessId: actor.businessId };
      const b = replenishmentBounds;
      const products = await rows(
        'ReadReplenishmentProductPage',
        productRow,
        { ...scope, salonId },
        b.productPage,
        b.products,
        budget,
      );
      const global = await rows(
        'ReadReplenishmentAliasPage',
        aliasRow,
        scope,
        b.aliasPage,
        b.globalAliases,
        budget,
      );
      const salon = await rows(
        'ReadReplenishmentSalonAliasPage',
        aliasRow,
        { ...scope, salonId },
        b.salonAliases + 1,
        b.salonAliases,
        budget,
      );
      const after = await readHeader(actor, salonId, budget);
      if (
        after.catalogRevision !== before.catalogRevision ||
        after.salonAliasRevision !== before.salonAliasRevision
      )
        throw new AiError('SOURCE_CHANGED');
      const known = new Set(products.map((p) => p.id));
      if (
        global.some(
          (a) => a.salonId !== null || a.source === 'SALON_CONFIRMED' || !known.has(a.productId),
        ) ||
        salon.some(
          (a) => a.salonId !== salonId || a.source !== 'SALON_CONFIRMED' || !known.has(a.productId),
        )
      )
        throw new AiError('SERVICE_UNAVAILABLE');
      return {
        ...before,
        aliases: [...global, ...salon] satisfies LookupAlias[],
        products: products.map((p): ReplenishmentProduct => {
          const hq = p.inventories.filter((i) => i.kind === 'HQ');
          const own = p.inventories.filter((i) => i.locationId === salonId);
          if (
            hq.length !== 1 ||
            own.length !== 1 ||
            hq[0].reserved > hq[0].onHand ||
            p.activeRequestIds.length > 1
          )
            throw new AiError('SERVICE_UNAVAILABLE');
          return {
            productId: p.id,
            productName: p.name,
            sourceCode: p.sourceCode,
            type: p.type,
            category: p.category,
            summaryEn: p.summaryEn,
            scentPl: p.scentPl,
            keywords: p.keywords,
            hqAvailable: hq[0].onHand - hq[0].reserved,
            salonOnHand: own[0].onHand,
            hqInventoryVersion: hq[0].version,
            salonInventoryVersion: own[0].version,
            activeRequestId: p.activeRequestIds[0] ?? null,
          };
        }),
      };
    },
  };
}
