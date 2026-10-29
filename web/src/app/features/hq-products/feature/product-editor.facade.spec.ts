import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import type {
  ProductDetail,
  ProductForm,
} from '../../../../../../shared/contracts/product-admin/index';
import { ProductAdminApi, ProductAdminError } from '../data-access/product-admin-api';
import { ProductEditorFacade } from './product-editor.facade';

const form: ProductForm = {
  name: 'Pomada Cement',
  brand: 'Not Bad Stuff',
  category: 'Pomady',
  type: 'pomada',
  summary: 'Volume.',
  scent: null,
  netContentMl: 100,
  retailPriceGrosz: 6900,
  sourceCode: '5905191055127',
  sourceUrl: 'https://example.com/cement',
  observedOn: '2026-09-22',
};
const detail = (patch: Partial<ProductDetail> = {}): ProductDetail => ({
  id: 'b:NBS-CEMENT-100',
  demoId: 'NBS-CEMENT-100',
  form,
  hq: { onHand: 18, reserved: 2, available: 16, version: 3 },
  revision: 7,
  catalogRevision: 7,
  ...patch,
});
const alias = {
  id: 'a1',
  phrase: 'beton',
  kind: 'NAME' as const,
  source: 'HQ' as const,
  editable: true,
  revision: 1,
};
function setup() {
  const api = {
    read: vi.fn().mockResolvedValue(detail()),
    create: vi.fn().mockResolvedValue(detail()),
    update: vi.fn().mockResolvedValue(detail({ revision: 8 })),
    setHqStock: vi.fn().mockResolvedValue({ onHand: 25, reserved: 2, available: 23, version: 4 }),
    listAliases: vi.fn().mockResolvedValue({ aliases: [alias], collisions: [] }),
    saveAliases: vi.fn(),
    cardState: vi.fn().mockRejectedValue(new ProductAdminError('NOT_FOUND')),
    attachCard: vi.fn(),
    processCard: vi.fn(),
  };
  TestBed.configureTestingModule({
    providers: [ProductEditorFacade, { provide: ProductAdminApi, useValue: api }],
  });
  return { api, facade: TestBed.inject(ProductEditorFacade) };
}

describe('ProductEditorFacade', () => {
  it('creates a new product with its HQ quantity and returns the new id', async () => {
    const { api, facade } = setup();
    facade.startNew();
    facade.model.set({ ...form, type: 'pomada', scent: '', hqOnHand: 5 });
    expect(await facade.save()).toBe('b:NBS-CEMENT-100');
    expect(api.create).toHaveBeenCalledWith({
      form,
      hqOnHand: 5,
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });
  it('loads an existing product and keeps the draft when a save is stale', async () => {
    const { api, facade } = setup();
    await facade.load('b:NBS-CEMENT-100');
    expect(facade.aliases()).toEqual([alias]);
    expect(facade.card()).toBeNull();
    facade.model.update((m) => ({ ...m, name: 'Nowa nazwa' }));
    api.update.mockRejectedValueOnce(new ProductAdminError('STALE_STATE'));
    api.read.mockResolvedValueOnce(detail({ revision: 9 }));
    await facade.save();
    expect(facade.message()).toBe(
      'Someone else changed this product. Your edits are kept; save again.',
    );
    expect(facade.model().name).toBe('Nowa nazwa');
    await facade.save();
    expect(api.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        expectedRevision: 9,
        form: expect.objectContaining({ name: 'Nowa nazwa' }),
      }),
    );
  });
  it('sets HQ stock from the loaded version and shows current numbers when it moved', async () => {
    const { api, facade } = setup();
    await facade.load('b:NBS-CEMENT-100');
    facade.stockDraft.set(25);
    await facade.saveStock();
    expect(api.setHqStock).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'b:NBS-CEMENT-100', expectedVersion: 3, onHand: 25 }),
    );
    expect(facade.stock()).toEqual({ onHand: 25, reserved: 2, available: 23, version: 4 });
    api.setHqStock.mockRejectedValueOnce(new ProductAdminError('STALE_STATE'));
    api.read.mockResolvedValueOnce(
      detail({ hq: { onHand: 20, reserved: 5, available: 15, version: 6 } }),
    );
    facade.stockDraft.set(30);
    await facade.saveStock();
    expect(facade.stock()?.version).toBe(6);
    expect(facade.stockMessage()).toBe(
      'Stock changed meanwhile (on hand 20, reserved 5). Enter the quantity again.',
    );
  });
  it('adds aliases with a default Name kind, shows collisions and retries an unknown outcome with the same key', async () => {
    const { api, facade } = setup();
    await facade.load('b:NBS-CEMENT-100');
    expect(facade.newAliasKind()).toBe('NAME');
    api.saveAliases.mockRejectedValueOnce(new ProductAdminError('UNKNOWN')).mockResolvedValueOnce({
      aliases: [alias, { ...alias, id: 'a2', phrase: 'matte', kind: 'TYPE' }],
      collisions: [{ phrase: 'matte', productNames: ['Mattifier'] }],
    });
    await facade.addAlias('matte', 'TYPE');
    expect(facade.aliasMessage()).toBe('The outcome is unknown. Retry to confirm.');
    await facade.retryAliases();
    expect(api.saveAliases.mock.calls[1][0].idempotencyKey).toBe(
      api.saveAliases.mock.calls[0][0].idempotencyKey,
    );
    expect(facade.collisions()).toEqual([{ phrase: 'matte', productNames: ['Mattifier'] }]);
    expect(facade.aliases()).toHaveLength(2);
  });
  it('attaches a card, waits for extraction, and accepts suggestions without touching the form draft', async () => {
    vi.useFakeTimers();
    const { api, facade } = setup();
    await facade.load('b:NBS-CEMENT-100');
    facade.model.update((m) => ({ ...m, name: 'Szkic' }));
    const uploading = {
      documentId: 'd',
      versionId: 'd:v1',
      status: 'UPLOADING' as const,
      suggestions: [],
    };
    api.attachCard.mockResolvedValue(uploading);
    api.processCard
      .mockRejectedValueOnce(new ProductAdminError('IN_PROGRESS'))
      .mockResolvedValueOnce({
        ...uploading,
        status: 'PUBLISHING',
        suggestions: [{ phrase: 'betonik', kind: 'PHONETIC', collisions: [] }],
      });
    const pending = facade.attachCard(new File(['%PDF-'], 'card.pdf'));
    await vi.advanceTimersByTimeAsync(5000);
    await pending;
    expect(facade.card()).toMatchObject({ status: 'PUBLISHING' });
    expect(facade.suggestions()).toEqual([{ phrase: 'betonik', kind: 'PHONETIC', collisions: [] }]);
    expect(facade.model().name).toBe('Szkic');
    api.saveAliases.mockResolvedValueOnce({ aliases: [alias], collisions: [] });
    await facade.acceptSuggestion(facade.suggestions()[0]);
    expect(api.saveAliases).toHaveBeenLastCalledWith(
      expect.objectContaining({ changes: [{ op: 'add', phrase: 'betonik', kind: 'PHONETIC' }] }),
    );
    expect(facade.suggestions()).toEqual([]);
    vi.useRealTimers();
  });
  it('resumes an unfinished card after reopening the product and retries a failed one', async () => {
    const { api, facade } = setup();
    const uploading = {
      documentId: 'd',
      versionId: 'd:v1',
      status: 'UPLOADING' as const,
      suggestions: [],
    };
    api.cardState.mockResolvedValueOnce(uploading);
    api.processCard.mockResolvedValueOnce({
      ...uploading,
      status: 'PUBLISHING',
      suggestions: [{ phrase: 'betonik', kind: 'PHONETIC', collisions: [] }],
    });
    await facade.load('b:NBS-CEMENT-100');
    await vi.waitFor(() => expect(facade.card()).toMatchObject({ status: 'PUBLISHING' }));
    expect(api.processCard).toHaveBeenCalledWith('b:NBS-CEMENT-100', 'd:v1', expect.any(String));
    api.processCard.mockResolvedValueOnce({ ...uploading, status: 'FAILED' });
    facade.card.set({ ...uploading, status: 'FAILED' });
    await facade.retryCard();
    expect(api.processCard).toHaveBeenCalledTimes(2);
    expect(facade.card()?.status).toBe('FAILED');
  });
  it('accepts all suggestions in one alias save and clears them', async () => {
    const { api, facade } = setup();
    await facade.load('b:NBS-CEMENT-100');
    facade.suggestions.set([
      { phrase: 'betonik', kind: 'PHONETIC', collisions: [] },
      { phrase: 'pomada', kind: 'TYPE', collisions: ['Pomada Matowa'] },
    ]);
    api.saveAliases.mockResolvedValueOnce({ aliases: [alias], collisions: [] });
    await facade.acceptAll([
      { phrase: 'betonik', kind: 'PHONETIC' },
      { phrase: 'pomada beton', kind: 'NAME' },
    ]);
    expect(api.saveAliases).toHaveBeenCalledTimes(1);
    expect(api.saveAliases).toHaveBeenLastCalledWith(
      expect.objectContaining({
        changes: [
          { op: 'add', phrase: 'betonik', kind: 'PHONETIC' },
          { op: 'add', phrase: 'pomada beton', kind: 'NAME' },
        ],
      }),
    );
    expect(facade.suggestions()).toEqual([]);
  });
});
