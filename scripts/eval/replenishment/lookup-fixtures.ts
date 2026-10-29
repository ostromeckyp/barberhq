import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { lookupProducts } from '../../../functions/src/ai/product-lookup.ts';
import { normalizeProduct } from '../../../shared/product-normalization.ts';
import type { LookupAlias, LookupProduct } from '../../../shared/contracts/product-lookup/index.ts';

/** Fixture-only lookup evaluation: no SQL, no provider, no stock or alias writes. */
type Fixture = {
  catalogs: Record<
    string,
    (Omit<LookupProduct, 'category' | 'summaryEn' | 'scentPl'> & Partial<LookupProduct>)[]
  >;
  aliases: (Pick<LookupAlias, 'productId' | 'phrase' | 'kind' | 'source'> & {
    salonId?: string;
    sourceVersionId?: string;
    withdrawn?: boolean;
  })[];
  cases: {
    id: string;
    catalog: string;
    salonId: string;
    query: string;
    match: string;
    ambiguous: boolean;
    expect: string[];
    fallback?: number;
  }[];
};
const { values } = parseArgs({ options: { fixture: { type: 'string' } } });
if (!values.fixture) throw new Error('Pass --fixture FILE');
const fixture = JSON.parse(readFileSync(values.fixture, 'utf8')) as Fixture;
// A withdrawn source is ineligible exactly as the SQL snapshot would exclude it.
const aliases: LookupAlias[] = fixture.aliases
  .filter((a) => !a.withdrawn)
  .map((a, i) => ({
    id: `fixture-${i}`,
    productId: a.productId,
    phrase: a.phrase,
    normalized: normalizeProduct(a.phrase),
    kind: a.kind,
    source: a.source,
    salonId: a.salonId ?? null,
    sourceVersionId: a.sourceVersionId ?? null,
    ambiguous: false,
    revision: 1,
  }));
const rows = fixture.cases.map((c) => {
  const products = fixture.catalogs[c.catalog].map((p) => ({
    category: '',
    summaryEn: '',
    scentPl: null,
    ...p,
  }));
  const result = lookupProducts(c.query, products, aliases, c.salonId);
  const ids = result.candidates.map((x) => x.productId);
  const expectedPresent =
    c.match === 'NONE'
      ? ids.length === (c.fallback ?? 0) && result.candidates.every((x) => x.via === null)
      : c.expect.length === ids.length && c.expect.every((id) => ids.includes(id));
  return {
    id: c.id,
    tier: result.match,
    ambiguous: result.ambiguous,
    candidates: ids.length,
    pass: result.match === c.match && result.ambiguous === c.ambiguous && expectedPresent,
  };
});
const report = {
  cases: rows.length,
  passed: rows.filter((r) => r.pass).length,
  providerCalls: 0,
  stockWrites: 0,
  aliasWrites: 0,
  nonemptyFallback: rows.filter((r) => r.tier === 'NONE' && r.candidates > 0).length,
  rows,
};
console.log(JSON.stringify(report, null, 2));
if (report.passed !== report.cases) process.exit(1);
