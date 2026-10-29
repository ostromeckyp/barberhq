import type {
  LookupAlias,
  LookupCandidate,
  LookupMatchTier,
  LookupProduct,
  ProductMatch,
} from '../../../shared/contracts/product-lookup.js';
import { normalizeProduct } from '../../../shared/product-normalization.js';

/** Light Polish inflection, base-normalized; longest suffix first. Lookup-only, never persisted. */
const suffixes = [
  'ami',
  'ach',
  'iej',
  'ego',
  'emu',
  'iem',
  'ow',
  'ej',
  'om',
  'em',
  'ie',
  'a',
  'e',
  'i',
  'y',
  'u',
];
const minStem = 3;

function stem(token: string): string {
  if (/^\d+$/.test(token)) return token;
  let out = token;
  const suffix = suffixes.find((s) => out.endsWith(s) && out.length - s.length >= minStem);
  if (suffix) out = out.slice(0, -suffix.length);
  // Fleeting e: a consonant + "ek" ending meets its inflected forms ("-ek" → "-k").
  if (out.length - 1 >= minStem) out = out.replace(/([^aeiouy])ek$/, '$1k');
  return out;
}

export function normalizeProductForMatch(text: string): string {
  return normalizeProduct(text).split(' ').filter(Boolean).map(stem).join(' ');
}

type Evidence = {
  productId: string;
  phrase: string;
  kind: LookupAlias['kind'];
  source: LookupAlias['source'] | 'CATALOG';
  ambiguous: boolean;
};
const collator = new Intl.Collator('pl');

function containsTokens(haystack: string[], needle: string[]): boolean {
  if (!needle.length || needle.length > haystack.length) return false;
  for (let i = 0; i + needle.length <= haystack.length; i++)
    if (needle.every((t, j) => haystack[i + j] === t)) return true;
  return false;
}

function result(
  query: string,
  match: LookupMatchTier,
  evidence: Evidence[],
  byId: Map<string, LookupProduct>,
): ProductMatch {
  const candidates = new Map<string, LookupCandidate>();
  for (const e of evidence)
    if (!candidates.has(e.productId))
      candidates.set(e.productId, {
        productId: e.productId,
        productName: byId.get(e.productId)!.productName,
        via: { phrase: e.phrase, kind: e.kind, source: e.source },
      });
  const sorted = [...candidates.values()].sort(
    (a, b) =>
      collator.compare(a.productName, b.productName) ||
      (a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0),
  );
  return {
    query,
    match,
    ambiguous: sorted.length > 1 || evidence.some((e) => e.ambiguous),
    candidates: sorted,
  };
}

/** Deterministic tiered lookup over a scoped snapshot; the first nonempty tier wins. */
export function lookupProducts(
  query: string,
  products: LookupProduct[],
  aliases: LookupAlias[],
  salonId: string,
): ProductMatch {
  const byId = new Map(products.map((p) => [p.productId, p]));
  const eligible = aliases.filter(
    (a) =>
      byId.has(a.productId) &&
      (a.source === 'SALON_CONFIRMED' ? a.salonId === salonId : a.salonId === null),
  );
  const needle = normalizeProductForMatch(query);
  const code = normalizeProduct(query);
  const all: (Evidence & { tier: Exclude<LookupMatchTier, 'NONE' | 'CONTAINS'> })[] = [];
  for (const a of eligible)
    all.push({
      productId: a.productId,
      phrase: a.phrase,
      kind: a.source === 'SALON_CONFIRMED' ? 'NAME' : a.kind,
      source: a.source,
      ambiguous: a.ambiguous,
      tier: a.source === 'SALON_CONFIRMED' ? 'SALON' : a.kind,
    });
  for (const p of products) {
    all.push({
      productId: p.productId,
      phrase: p.productName,
      kind: 'NAME',
      source: 'CATALOG',
      ambiguous: false,
      tier: 'NAME',
    });
    if (p.type)
      all.push({
        productId: p.productId,
        phrase: p.type,
        kind: 'TYPE',
        source: 'CATALOG',
        ambiguous: false,
        tier: 'TYPE',
      });
  }
  if (needle) {
    for (const tier of ['SALON', 'NAME', 'PHONETIC', 'TYPE'] as const) {
      const hits = all.filter(
        (e) => e.tier === tier && normalizeProductForMatch(e.phrase) === needle,
      );
      if (tier === 'NAME' && code)
        for (const p of products)
          if (normalizeProduct(p.sourceCode) === code)
            hits.push({
              productId: p.productId,
              phrase: p.sourceCode,
              kind: 'NAME',
              source: 'CATALOG',
              ambiguous: false,
              tier,
            });
      if (hits.length) return result(query, tier, hits, byId);
    }
    const tokens = needle.split(' ');
    const contained = [
      ...all,
      ...products.flatMap((p) =>
        p.keywords.map((k) => ({
          productId: p.productId,
          phrase: k,
          kind: 'TYPE' as const,
          source: 'CATALOG' as const,
          ambiguous: false,
        })),
      ),
    ].filter((e) => {
      const other = normalizeProductForMatch(e.phrase).split(' ').filter(Boolean);
      return containsTokens(other, tokens) || containsTokens(tokens, other);
    });
    if (contained.length) return result(query, 'CONTAINS', contained, byId);
  }
  const fallback = result(
    query,
    'NONE',
    products.map((p) => ({
      productId: p.productId,
      phrase: '',
      kind: 'NAME',
      source: 'CATALOG',
      ambiguous: false,
    })),
    byId,
  );
  return { ...fallback, candidates: fallback.candidates.map((c) => ({ ...c, via: null })) };
}
