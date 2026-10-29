import { z } from 'zod';
import {
  productCategories,
  type CreateProductInput,
  type SaveProductAliasesInput,
  type SetHqStockInput,
  type UpdateProductInput,
} from '../../../shared/contracts/product-admin/index.js';
import { KnowledgeError } from '../knowledge/repository.js';

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .refine((v) => [...v].length <= max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .refine((v) => [...v].length <= max)
    .transform((v) => (v ? v : null))
    .nullable();
const maxInt = 2147483647;
const key = z.string().uuid();
const identifier = z.string().min(1).max(200);
const form = z
  .object({
    name: text(120),
    brand: text(120),
    category: z.enum(productCategories),
    type: optionalText(80),
    summary: text(2000),
    scent: optionalText(120),
    netContentMl: z.number().int().min(1).max(100000),
    retailPriceGrosz: z.number().int().min(0).max(maxInt),
    sourceCode: text(64),
    sourceUrl: z
      .string()
      .trim()
      .url()
      .max(2000)
      .refine((v) => v.startsWith('https://')),
    observedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();
const create = z
  .object({ form, hqOnHand: z.number().int().min(0).max(maxInt), idempotencyKey: key })
  .strict();
const update = z
  .object({
    productId: identifier,
    expectedRevision: z.number().int().min(0).max(maxInt),
    form,
    idempotencyKey: key,
  })
  .strict();
const stock = z
  .object({
    productId: identifier,
    expectedVersion: z.number().int().min(1).max(maxInt),
    onHand: z.number().int().min(0).max(maxInt),
    idempotencyKey: key,
  })
  .strict();
const kind = z.enum(['NAME', 'PHONETIC', 'TYPE']);
const revision = z.number().int().min(0).max(maxInt);
const aliases = z
  .object({
    productId: identifier,
    changes: z
      .array(
        z.discriminatedUnion('op', [
          z.object({ op: z.literal('add'), phrase: text(120), kind }).strict(),
          z
            .object({
              op: z.literal('edit'),
              aliasId: identifier,
              expectedRevision: revision,
              phrase: text(120),
              kind,
            })
            .strict(),
          z
            .object({ op: z.literal('remove'), aliasId: identifier, expectedRevision: revision })
            .strict(),
        ]),
      )
      .min(1)
      .max(32),
    idempotencyKey: key,
  })
  .strict();

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new KnowledgeError('VALIDATION_ERROR');
  return result.data;
}
export const parseCreateProduct = (input: unknown): CreateProductInput => parse(create, input);
export const parseUpdateProduct = (input: unknown): UpdateProductInput => parse(update, input);
export const parseSetHqStock = (input: unknown): SetHqStockInput => parse(stock, input);
export const parseSaveProductAliases = (input: unknown): SaveProductAliasesInput =>
  parse(aliases, input);
