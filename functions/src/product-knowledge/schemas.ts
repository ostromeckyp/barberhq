import { z } from 'zod';
import type {
  SaveKnowledgeProductReviewInput,
  ProductAliasGeneration,
  AcceptKnowledgeProductReviewInput,
  SuggestKnowledgeProductLinkInput,
  GenerateKnowledgeProductAliasesInput,
} from '../../../shared/contracts/product-knowledge/index.js';
import { normalizeProduct } from '../../../shared/product-normalization.js';
import { KnowledgeError } from '../knowledge/repository.js';
const id = z.string().min(1).max(200);
const revision = z.int().min(0).max(2147483647);
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const unicode = (limit: number) =>
  z
    .string()
    .trim()
    .min(1)
    .refine((v) => [...v].length <= limit);
const phrase = unicode(120).refine((v) => normalizeProduct(v).length > 0);
const kind = z.enum(['name', 'type', 'phonetic']);
const lang = z.enum(['pl', 'en']);
export const knowledgePassageSchema = z
  .strictObject({
    chunkId: id,
    start: z.int().min(0).max(2147483647),
    end: z.int().min(1).max(2147483647),
  })
  .refine((v) => v.end > v.start);
const aliasEdit = z.strictObject({
  id: id.optional(),
  phrase,
  kind,
  lang,
  decision: z.enum(['pending', 'accepted', 'rejected']),
});
const unique = (values: (string | undefined)[]) => {
  const present = values.filter((v) => v !== undefined);
  return new Set(present).size === present.length;
};
const base = {
  versionId: id,
  extractionHash: sha,
  expectedReviewRevision: revision,
  idempotencyKey: z.uuid(),
};
const saveSchema = z
  .strictObject({
    ...base,
    links: z
      .array(
        z
          .strictObject({
            id: id.optional(),
            passage: knowledgePassageSchema,
            productId: id.nullable(),
            confirmed: z.boolean(),
          })
          .refine((l) => !l.confirmed || l.productId !== null),
      )
      .max(200),
    profiles: z
      .array(
        z.strictObject({
          productId: id,
          type: unicode(80).nullable(),
          aliases: z.array(aliasEdit).max(32),
        }),
      )
      .max(200),
    acknowledgedUnlinkedPassages: z.array(knowledgePassageSchema).max(400),
    emptyKnowledgeAcknowledged: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const groups = [
      v.links.map((l) => l.id),
      v.profiles.map((p) => p.productId),
      v.profiles.flatMap((p) => p.aliases.map((a) => a.id)),
      v.acknowledgedUnlinkedPassages.map((p) => JSON.stringify(p)),
    ];
    if (groups.some((g) => !unique(g)))
      ctx.addIssue({ code: 'custom', message: 'Duplicate review identities' });
    for (const p of v.profiles) {
      const aliases = p.aliases.map((a) =>
        JSON.stringify([normalizeProduct(a.phrase), a.kind, a.lang]),
      );
      if (!unique(aliases)) ctx.addIssue({ code: 'custom', message: 'Duplicate candidate alias' });
    }
  });
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new KnowledgeError('VALIDATION_ERROR', 'Invalid product knowledge command');
  return parsed.data;
}
export function parseSaveKnowledgeProductReview(value: unknown): SaveKnowledgeProductReviewInput {
  return parse(saveSchema, value);
}
export const productAliasGenerationSchema = z.strictObject({
  type: unicode(80).nullable(),
  aliases: z.array(z.strictObject({ phrase, kind, lang })).max(32),
});
export const productLinkSuggestionSchema = z.strictObject({ productIds: z.array(id).max(1) });
export function parseProductAliasGeneration(value: unknown): ProductAliasGeneration {
  return parse(productAliasGenerationSchema, value);
}
export function parseProductLinkSuggestion(value: unknown): { productIds: string[] } {
  return parse(productLinkSuggestionSchema, value);
}
export function parseAcceptKnowledgeProductReview(
  value: unknown,
): AcceptKnowledgeProductReviewInput {
  return parse(z.strictObject({ ...base, expectedCatalogRevision: revision }), value);
}
export function parseSuggestKnowledgeProductLink(value: unknown): SuggestKnowledgeProductLinkInput {
  return parse(z.strictObject({ ...base, passage: knowledgePassageSchema }), value);
}
export function parseGenerateKnowledgeProductAliases(
  value: unknown,
): GenerateKnowledgeProductAliasesInput {
  return parse(z.strictObject({ ...base, productId: id }), value);
}
