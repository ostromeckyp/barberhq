import { z } from 'zod';
import type { BusinessSeed, Location } from '../../shared/contracts/business/index.ts';
const ids = [
  'NBS-MATOWA-100',
  'NBS-DRYMATT-100',
  'NBS-CEMENT-100',
  'NBS-SOL-200',
  'NBS-SAVAGE-50',
  'NBS-MATTIFIER-100',
];
const seedPhrase = z.string().trim().min(1).max(120);
const productSchema = z.object({
  demoId: z.enum(ids as [string, ...string[]]),
  name: z.string().min(1),
  brand: z.literal('Not Bad Stuff'),
  sourceCode: z.string().min(1),
  netContent: z.object({
    value: z.number().int().positive(),
    unit: z.literal('ml'),
  }),
  displayedRetailPrice: z.object({
    amount: z
      .number()
      .finite()
      .nonnegative()
      .refine(
        (n) =>
          Number.isSafeInteger(Math.round(n * 100)) &&
          Math.abs(n * 100 - Math.round(n * 100)) < 1e-6,
      ),
    currency: z.literal('PLN'),
  }),
  category: z.string(),
  summaryEn: z.string(),
  scentPl: z.string().nullable(),
  sourceUrl: z.url().refine((u) => new URL(u).hostname === 'notbadstuff.pl'),
  observedOn: z.iso.date(),
  transferPackSize: z.null(),
  packageDimensionsMm: z.null(),
  shippingWeightGrams: z.null(),
  // Seed knowledge for the ordering assistant; reset restores it with the products.
  type: seedPhrase.nullable(),
  keywords: z.array(seedPhrase).max(20),
  aliases: z
    .array(
      z.strictObject({
        phrase: seedPhrase,
        kind: z.enum(['NAME', 'TYPE', 'PHONETIC']),
        lang: z.enum(['pl', 'en']),
      }),
    )
    .max(50),
});
const snapshotSchema = z.object({
  brand: z.literal('Not Bad Stuff'),
  products: z.array(productSchema).length(6),
});
export type CatalogSnapshot = z.input<typeof snapshotSchema>;
export function buildSeed(catalog: unknown): BusinessSeed {
  const { products } = snapshotSchema.parse(catalog);
  if (new Set(products.map((p) => p.demoId)).size !== 6)
    throw new Error('Product IDs must be unique');
  const businessKey = 'not-bad-stuff-demo' as const;
  const locations: Location[] = [
    { id: `${businessKey}:hq`, key: 'hq', name: 'HQ warehouse', kind: 'HQ' },
    {
      id: `${businessKey}:legnicka`,
      key: 'legnicka',
      name: 'Legnicka',
      kind: 'SALON',
    },
    {
      id: `${businessKey}:lodzka`,
      key: 'lodzka',
      name: 'Łódzka',
      kind: 'SALON',
    },
    {
      id: `${businessKey}:zakladowa`,
      key: 'zakladowa',
      name: 'Zakładowa',
      kind: 'SALON',
    },
  ];
  const seed: BusinessSeed = {
    businessKey,
    locations,
    products: products.map(({ displayedRetailPrice, ...p }) => ({
      ...p,
      id: `${businessKey}:${p.demoId}`,
      retailPriceGrosz: Math.round(displayedRetailPrice.amount * 100),
    })),
    inventory: locations.flatMap((l) =>
      products.map((p) => ({
        locationKey: l.key,
        productDemoId: p.demoId,
        onHand: l.kind === 'HQ' ? 18 : 2,
        reserved: 0 as const,
      })),
    ),
  };
  return validateSeed(seed);
}
export function validateSeed(input: unknown): BusinessSeed {
  const seedSchema = z.object({
    businessKey: z.literal('not-bad-stuff-demo'),
    products: z
      .array(
        productSchema.omit({ displayedRetailPrice: true }).extend({
          id: z.string().min(1),
          retailPriceGrosz: z.number().int().nonnegative().safe(),
        }),
      )
      .length(6),
    locations: z
      .array(
        z.object({
          id: z.string().min(1),
          key: z.enum(['hq', 'legnicka', 'lodzka', 'zakladowa']),
          name: z.string().min(1),
          kind: z.enum(['HQ', 'SALON']),
        }),
      )
      .length(4),
    inventory: z
      .array(
        z.object({
          locationKey: z.enum(['hq', 'legnicka', 'lodzka', 'zakladowa']),
          productDemoId: z.string(),
          onHand: z.number().int().nonnegative().safe(),
          reserved: z.literal(0),
        }),
      )
      .length(24),
  });
  const parsed = seedSchema.parse(input);
  const keys = new Set(parsed.inventory.map((r) => `${r.locationKey}/${r.productDemoId}`));
  if (
    keys.size !== 24 ||
    new Set(parsed.products.map((p) => p.demoId)).size !== 6 ||
    new Set(parsed.locations.map((l) => l.key)).size !== 4
  )
    throw new Error('Duplicate seed keys');
  if (parsed.inventory.some((r) => !parsed.products.some((p) => p.demoId === r.productDemoId)))
    throw new Error('Unknown seed product');
  if (
    parsed.products.some((p) => p.id !== `${parsed.businessKey}:${p.demoId}`) ||
    parsed.locations.some(
      (l) =>
        l.id !== `${parsed.businessKey}:${l.key}` || l.kind !== (l.key === 'hq' ? 'HQ' : 'SALON'),
    )
  )
    throw new Error('Invalid business-scoped identity');
  return parsed;
}
