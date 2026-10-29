import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateSeed } from '../../scripts/prepare-data/catalog.ts';
import {
  checkKnowledgeSeed,
  readKnowledgeSeed,
  validateKnowledgeSeed,
} from '../../scripts/seed/knowledge-seed.ts';

const businessSeed = validateSeed(JSON.parse(readFileSync('data/seed/business.json', 'utf8')));
const cardPdfs = readdirSync('data/knowledge/pdfs/product-cards').filter((f) => f.endsWith('.pdf'));

describe('knowledge seed', () => {
  it('manifest has one product-card entry per product card PDF', async () => {
    const seed = await readKnowledgeSeed();
    const cards = seed.entries.filter((e) => e.kind === 'product-card');
    expect(cards).toHaveLength(cardPdfs.length);
    expect(cards.map((c) => c.inputPdf).sort()).toEqual(
      cardPdfs.map((f) => `data/knowledge/pdfs/product-cards/${f}`).sort(),
    );
    const demoIds = businessSeed.products.map((p) => p.demoId);
    for (const card of cards) {
      expect(card).toMatchObject({ language: 'pl', origin: 'public-compilation' });
      expect(demoIds).toContain(card.productDemoId);
      expect(card.sha256).toBe(createHash('sha256').update(card.bytes).digest('hex'));
    }
    expect(new Set(cards.map((c) => c.productDemoId)).size).toBe(cards.length);
  });

  it('card title, sourceUrls and observedOn come from the product', async () => {
    const seed = await readKnowledgeSeed();
    for (const card of seed.entries.filter((e) => e.kind === 'product-card')) {
      const product = businessSeed.products.find((p) => p.demoId === card.productDemoId)!;
      expect(card.title).toBe(`${product.name} — karta produktu`);
      expect(card.sourceUrls).toEqual([product.sourceUrl]);
      expect(card.observedOn).toBe(product.observedOn);
    }
  });

  it('the real seed is complete: every entry has a matching owner approval', async () => {
    expect(validateKnowledgeSeed(await readKnowledgeSeed(), businessSeed)).toEqual([]);
  });

  it('reports a sha mismatch', async () => {
    const seed = await readKnowledgeSeed();
    const entry = seed.entries.find((e) => e.documentId === 'CARD-NBS-SAVAGE-50')!;
    entry.bytes = Uint8Array.from(entry.bytes);
    entry.bytes[10] ^= 1;
    expect(validateKnowledgeSeed(seed, businessSeed)).toContain(
      'CARD-NBS-SAVAGE-50 v1: PDF_HASH_MISMATCH',
    );
  });

  it('reports a missing receipt', async () => {
    const seed = await readKnowledgeSeed();
    seed.entries.find((e) => e.documentId === 'REP-001')!.receipt = null;
    expect(validateKnowledgeSeed(seed, businessSeed)).toContain('REP-001 v1: RECEIPT_MISSING');
  });

  it('reports a receipt for another sha', async () => {
    const seed = await readKnowledgeSeed();
    const entry = seed.entries.find((e) => e.documentId === 'REP-001')!;
    entry.receipt = {
      ...entry.receipt!,
      review: { ...entry.receipt!.review, pdfSha256: 'a'.repeat(64) },
    };
    expect(validateKnowledgeSeed(seed, businessSeed)).toContain('REP-001 v1: RECEIPT_MISMATCH');
  });

  it('rejects productDemoId on non-card kinds and requires it on cards', async () => {
    const seed = await readKnowledgeSeed();
    seed.entries.find((e) => e.documentId === 'REP-001')!.productDemoId = 'NBS-SOL-200';
    delete seed.entries.find((e) => e.documentId === 'CARD-NBS-SOL-200')!.productDemoId;
    const problems = validateKnowledgeSeed(seed, businessSeed);
    expect(problems).toContain('REP-001 v1: PRODUCT_LINK_INVALID');
    expect(problems).toContain('CARD-NBS-SOL-200 v1: PRODUCT_LINK_INVALID');
  });
});

describe('product facts', () => {
  it('each card carries its product facts and no catalog compilation is seeded', async () => {
    const { extractPdf } = await import('../../functions/src/knowledge/extract.ts');
    const seed = await readKnowledgeSeed();
    expect(seed.entries.some((e) => e.kind === 'product-catalog')).toBe(false);
    for (const card of seed.entries.filter((e) => e.kind === 'product-card')) {
      const product = businessSeed.products.find((p) => p.demoId === card.productDemoId)!;
      const text = (await extractPdf(card.bytes)).pages.map((p) => p.markdown).join(' ');
      for (const fact of [
        product.name,
        product.sourceCode,
        `${product.netContent.value} ${product.netContent.unit}`,
        product.category,
        product.summaryEn,
        product.sourceUrl,
      ])
        expect(text, `${card.documentId}: ${fact}`).toContain(fact);
    }
  });
});

describe('preflight', () => {
  it('reports an extraction that no longer matches the approved receipt, before any wipe', async () => {
    const seed = await readKnowledgeSeed();
    const entry = seed.entries.find((e) => e.documentId === 'DAM-001' && e.version === 'v0')!;
    entry.receipt = {
      ...entry.receipt!,
      review: { ...entry.receipt!.review, extractionHash: 'b'.repeat(64) },
    };
    const { problems, embeddingTexts } = await checkKnowledgeSeed(seed, businessSeed);
    expect(problems).toEqual(['DAM-001 v0: EXTRACTION_CHANGED']);
    expect(embeddingTexts).toBeGreaterThan(0);
  });

  it('binds each delivery problem kind to exactly one seeded procedure', async () => {
    const seed = await readKnowledgeSeed();
    expect(
      seed.entries
        .filter((e) => e.deliveryProblemKind)
        .map((e) => [e.deliveryProblemKind, e.documentId]),
    ).toEqual([
      ['DAMAGED', 'DAM-001'],
      ['MISSING', 'DIS-001'],
    ]);
    seed.entries.find((e) => e.documentId === 'REP-001')!.deliveryProblemKind = 'DAMAGED';
    expect(validateKnowledgeSeed(seed, businessSeed)).toContain('REP-001 v1: BINDING_INVALID');
  });
});
