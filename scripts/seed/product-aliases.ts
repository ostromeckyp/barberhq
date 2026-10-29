import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { initializeApp, deleteApp, applicationDefault } from 'firebase-admin/app';
import { getDataConnect, type DataConnect } from 'firebase-admin/data-connect';
import { z } from 'zod';
import { normalizeProduct } from '../../shared/product-normalization.ts';
import type { BusinessSeed } from '../../shared/contracts/business.ts';
import { parsePublicConfig } from '../config/public-config.ts';
import { validateSeed } from '../prepare-data/catalog.ts';

const kind = z.enum(['NAME', 'TYPE', 'PHONETIC']);
/** Seed aliases, type and keywords per product, taken from the business seed products. */
export type AliasSeedFile = {
  businessKey: string;
  products: Pick<BusinessSeed['products'][number], 'demoId' | 'type' | 'keywords' | 'aliases'>[];
};
export function aliasSeedFromBusinessSeed(seed: BusinessSeed): AliasSeedFile {
  return {
    businessKey: seed.businessKey,
    products: seed.products.map(({ demoId, type, keywords, aliases }) => ({
      demoId,
      type,
      keywords,
      aliases,
    })),
  };
}
/** Reads and validates data/seed/business.json; the only source of seed aliases. */
export function readAliasSeed(path = 'data/seed/business.json'): AliasSeedFile {
  return aliasSeedFromBusinessSeed(validateSeed(JSON.parse(readFileSync(path, 'utf8'))));
}

/** Deterministic seed identity: business/product/kind/base-normalized phrase/language. */
export function seedAliasId(
  businessId: string,
  productId: string,
  aliasKind: string,
  text: string,
  lang: string,
): string {
  const key = [businessId, productId, aliasKind, normalizeProduct(text), lang].join('\u0000');
  return `seed:${createHash('sha256').update(key).digest('hex').slice(0, 40)}`;
}

type AliasStatus = 'PROPOSED' | 'ACTIVE' | 'REJECTED' | 'RETIRED';
export type AliasSeedState = {
  revision: number;
  products: {
    id: string;
    demoId: string;
    seedType: string | null;
    keywords: string[];
    typeSourceVersionId: string | null;
  }[];
  aliases: {
    id: string;
    productId: string;
    phrase: string;
    normalized: string;
    kind: z.infer<typeof kind>;
    lang: string;
    source: 'GENERATED' | 'HQ' | 'SEED' | 'SALON_CONFIRMED';
    status: AliasStatus;
    /** HQ edited or removed this seed phrase in the app; the seed leaves it alone. */
    overriddenByHq?: boolean;
  }[];
};
export type SeedAliasRow = Omit<AliasSeedState['aliases'][number], 'status' | 'overriddenByHq'> & {
  source: 'SEED';
};
export type AliasSeedPlan = {
  expectedRevision: number;
  changed: boolean;
  upserts: SeedAliasRow[];
  retire: string[];
  products: { id: string; seedType: string | null; keywords: string[] }[];
};

/** Pure diff; only SEED rows are managed, other sources are never touched. */
export function planProductAliasSeed(
  file: AliasSeedFile,
  businessId: string,
  state: AliasSeedState,
): AliasSeedPlan {
  const desired = new Map<string, SeedAliasRow>();
  const products: AliasSeedPlan['products'] = [];
  for (const entry of file.products) {
    const product = state.products.find((p) => p.demoId === entry.demoId);
    if (!product) throw new Error(`Seed product ${entry.demoId} is absent from the catalog`);
    for (const a of entry.aliases) {
      const id = seedAliasId(businessId, product.id, a.kind, a.phrase, a.lang);
      desired.set(id, {
        id,
        productId: product.id,
        phrase: a.phrase,
        normalized: normalizeProduct(a.phrase),
        kind: a.kind,
        lang: a.lang,
        source: 'SEED',
      });
    }
    if (
      product.seedType !== entry.type ||
      JSON.stringify(product.keywords) !== JSON.stringify(entry.keywords)
    )
      products.push({ id: product.id, seedType: entry.type, keywords: entry.keywords });
  }
  const seeded = state.aliases.filter((a) => a.source === 'SEED');
  const upserts = [...desired.values()].filter((d) => {
    const current = seeded.find((a) => a.id === d.id);
    if (current?.overriddenByHq) return false;
    return !current || current.status !== 'ACTIVE' || current.phrase !== d.phrase;
  });
  const retire = seeded
    .filter((a) => !desired.has(a.id) && a.status !== 'RETIRED' && !a.overriddenByHq)
    .map((a) => a.id);
  return {
    expectedRevision: state.revision,
    changed: upserts.length + retire.length + products.length > 0,
    upserts,
    retire,
    products,
  };
}

export function parseAliasSeedArgs(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      project: { type: 'string' },
      business: { type: 'string' },
      config: { type: 'string' },
      apply: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
    },
  });
  if (
    !values.project ||
    !values.business ||
    !values.config ||
    Boolean(values.apply) === Boolean(values['dry-run'])
  )
    throw new Error(
      'Pass --project ID --business ID --config FILE and exactly one of --dry-run / --apply',
    );
  return {
    projectId: values.project,
    businessId: values.business,
    configPath: values.config,
    apply: Boolean(values.apply),
  };
}

const stateSchema = z.object({
  business: z.object({ productKnowledgeRevision: z.number().int() }),
  products: z
    .array(
      z.object({
        id: z.string(),
        demoId: z.string(),
        seedType: z.string().nullable(),
        keywords: z.array(z.string()).nullable(),
        typeSourceVersionId: z.string().nullable(),
      }),
    )
    .max(200),
  productAliases: z
    .array(
      z.object({
        id: z.string(),
        productId: z.string(),
        phrase: z.string(),
        normalized: z.string(),
        kind,
        lang: z.string(),
        source: z.enum(['GENERATED', 'HQ', 'SEED', 'SALON_CONFIRMED']),
        status: z.enum(['PROPOSED', 'ACTIVE', 'REJECTED', 'RETIRED']),
        overriddenByHq: z.boolean().optional(),
      }),
    )
    .max(5000),
});
export async function readAliasSeedState(dc: DataConnect, businessId: string) {
  const data = stateSchema.parse(
    (await dc.executeQuery('ReadProductAliasSeedState', { businessId })).data,
  );
  return {
    revision: data.business.productKnowledgeRevision,
    products: data.products.map((p) => ({ ...p, keywords: p.keywords ?? [] })),
    aliases: data.productAliases,
  } satisfies AliasSeedState;
}

/** Dry-run reads only; apply writes one native transaction fenced by the business revision. */
export async function runProductAliasSeed(
  dc: DataConnect,
  file: AliasSeedFile,
  businessId: string,
  apply: boolean,
) {
  const plan = planProductAliasSeed(file, businessId, await readAliasSeedState(dc, businessId));
  const report = {
    expectedRevision: plan.expectedRevision,
    upserts: plan.upserts.length,
    retire: plan.retire.length,
    products: plan.products.length,
    applied: false,
  };
  if (!apply || !plan.changed) return report;
  const now = new Date().toISOString();
  await dc.executeMutation('ApplyProductAliasSeed', {
    businessId,
    expectedRevision: plan.expectedRevision,
    aliasesJson: JSON.stringify(
      plan.upserts.map((a) => ({
        id: a.id,
        business_id: businessId,
        product_id: a.productId,
        salon_id: null,
        phrase: a.phrase,
        normalized: a.normalized,
        kind: a.kind,
        lang: a.lang,
        source: 'SEED',
        status: 'ACTIVE',
        ambiguous: false,
        source_document_version_id: null,
        created_by: 'seed',
        created_at: now,
        revision: 1,
        overridden_by_hq: false,
      })),
    ),
    retireJson: JSON.stringify(plan.retire),
    productsJson: JSON.stringify(plan.products),
  });
  return { ...report, applied: true };
}

async function main() {
  const args = parseAliasSeedArgs(process.argv.slice(2));
  const config = parsePublicConfig(JSON.parse(readFileSync(args.configPath, 'utf8')));
  if (config.projectId !== args.projectId)
    throw new Error('The config project does not match --project');
  const local = args.projectId.startsWith('demo-');
  if (local !== Boolean(process.env.DATA_CONNECT_EMULATOR_HOST))
    throw new Error('Demo projects require an emulator host; cloud projects refuse one');
  const file = readAliasSeed();
  const app = initializeApp(
    { projectId: args.projectId, ...(local ? {} : { credential: applicationDefault() }) },
    `alias-seed-${Date.now()}`,
  );
  try {
    const dc = getDataConnect(
      {
        connector: 'server',
        serviceId: config.dataConnect.serviceId,
        location: config.dataConnect.location,
      },
      app,
    );
    console.log({
      ...args,
      report: await runProductAliasSeed(dc, file, args.businessId, args.apply),
    });
  } finally {
    await deleteApp(app);
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await main();
