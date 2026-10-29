import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createProductAdminCommands } from '../../functions/src/products/commands.ts';
import type { ProductForm } from '../../shared/contracts/product-admin/index.ts';
import { createLookupHarness, type LookupHarness } from '../support/replenishment.ts';

const form = (patch: Partial<ProductForm> = {}): ProductForm => ({
  name: 'Pomada Testowa',
  brand: 'Not Bad Stuff',
  category: 'Pomady',
  type: 'pomada',
  summary: 'Medium hold.',
  scent: null,
  netContentMl: 100,
  retailPriceGrosz: 6900,
  sourceCode: '5900000000001',
  sourceUrl: 'https://example.com/p',
  observedOn: '2026-10-28',
  ...patch,
});

describe('Feature: HQ product administration', () => {
  let h: LookupHarness;
  beforeEach(async () => {
    h = await createLookupHarness('products');
  });
  afterEach(async () => {
    if (h) await h.dispose();
  });
  const commands = () => createProductAdminCommands(h.dc);
  const revision = async () =>
    (
      await h.gql<{ business: { productKnowledgeRevision: number } }>(
        'query($id:String!){business(id:$id){productKnowledgeRevision}}',
        { id: h.businessId },
      )
    ).business.productKnowledgeRevision;
  const inventory = async (productId: string) =>
    (
      await h.gql<{
        inventories: { locationId: string; onHand: number; reserved: number; version: number }[];
      }>(
        'query($p:String!){inventories(where:{productId:{eq:$p}},orderBy:{locationId:ASC}){locationId onHand reserved version}}',
        { p: productId },
      )
    ).inventories;

  it('creates a product with HQ stock and zero stock in every salon, idempotently', async () => {
    const before = await revision();
    const key = randomUUID();
    const created = await commands().create(h.users.hq, {
      form: form(),
      hqOnHand: 7,
      idempotencyKey: key,
    });
    expect(created).toMatchObject({ form: form(), hq: { onHand: 7, reserved: 0, available: 7 } });
    expect(created.id).toBe(`${h.businessId}:${created.demoId}`);
    const rows = await inventory(created.id);
    expect(rows.find((r) => r.locationId === h.hqId)).toMatchObject({ onHand: 7 });
    expect(rows.filter((r) => r.locationId !== h.hqId).map((r) => r.onHand)).toEqual([0, 0, 0]);
    expect(await revision()).toBe(before + 1);
    expect(
      await commands().create(h.users.hq, { form: form(), hqOnHand: 7, idempotencyKey: key }),
    ).toEqual(created);
    await expect(
      commands().create(h.users.hq, {
        form: form({ name: 'Inna' }),
        hqOnHand: 1,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('updates fields under catalog revision CAS and marks the product as HQ-edited', async () => {
    const productId = h.productId('NBS-CEMENT-100');
    const current = await commands().read(h.users.hq, productId);
    const updated = await commands().update(h.users.hq, {
      productId,
      expectedRevision: current.revision,
      form: { ...current.form, name: 'Cement Nowy', type: 'pasta' },
      idempotencyKey: randomUUID(),
    });
    expect(updated.form).toMatchObject({ name: 'Cement Nowy', type: 'pasta' });
    expect(updated.catalogRevision).toBe(current.catalogRevision + 1);
    const row = await h.gql<{
      product: { hqUpdatedBy: string; hqUpdatedAt: string; seedType: string; type: string };
    }>('query($id:String!){product(id:$id){hqUpdatedBy hqUpdatedAt seedType type}}', {
      id: productId,
    });
    expect(row.product).toMatchObject({
      hqUpdatedBy: h.users.hq,
      seedType: 'pasta',
      type: 'pasta',
    });
    await expect(
      commands().update(h.users.hq, {
        productId,
        expectedRevision: current.revision,
        form: current.form,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'STALE_STATE' });
    await expect(
      commands().update(h.users.hq, {
        productId,
        expectedRevision: updated.revision,
        form: { ...current.form, sourceCode: '5905191055165' },
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('sets HQ stock under version CAS, never below reserved, with a journal row', async () => {
    const productId = h.productId('NBS-SOL-200');
    const start = (await commands().read(h.users.hq, productId)).hq;
    const before = await revision();
    const key = randomUUID();
    const set = await commands().setHqStock(h.users.hq, {
      productId,
      expectedVersion: start.version,
      onHand: 25,
      idempotencyKey: key,
    });
    expect(set).toEqual({ onHand: 25, reserved: 0, available: 25, version: start.version + 1 });
    expect(
      await commands().setHqStock(h.users.hq, {
        productId,
        expectedVersion: start.version,
        onHand: 25,
        idempotencyKey: key,
      }),
    ).toEqual(set);
    expect(await revision()).toBe(before);
    const journal = await h.gql<{
      hqStockAdjustments: { before: number; after: number; actorUid: string }[];
    }>('query($p:String!){hqStockAdjustments(where:{productId:{eq:$p}}){before after actorUid}}', {
      p: productId,
    });
    expect(journal.hqStockAdjustments).toEqual([
      { before: start.onHand, after: 25, actorUid: h.users.hq },
    ]);
    await h.gql(
      'mutation($l:String!,$p:String!){inventory_update(key:{locationId:$l,productId:$p},data:{reserved:4,version_update:{inc:1}})}',
      {
        l: h.hqId,
        p: productId,
      },
    );
    await expect(
      commands().setHqStock(h.users.hq, {
        productId,
        expectedVersion: set.version,
        onHand: 10,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'STALE_STATE' });
    await expect(
      commands().setHqStock(h.users.hq, {
        productId,
        expectedVersion: set.version + 1,
        onHand: 3,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    const outcomes = await Promise.allSettled(
      [11, 12].map((onHand) =>
        commands().setHqStock(h.users.hq, {
          productId,
          expectedVersion: set.version + 1,
          onHand,
          idempotencyKey: randomUUID(),
        }),
      ),
    );
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
  });

  it('denies salon staff and other businesses on every command', async () => {
    const productId = h.productId('NBS-CEMENT-100');
    const current = await commands().read(h.users.hq, productId);
    for (const uid of [h.users.legnicka, h.users.foreign]) {
      await expect(commands().read(uid, productId)).rejects.toMatchObject({ code: 'FORBIDDEN' });
      const created = commands().create(uid, {
        form: form({ sourceCode: 'x1' }),
        hqOnHand: 1,
        idempotencyKey: randomUUID(),
      });
      if (uid === h.users.legnicka)
        await expect(created).rejects.toMatchObject({ code: 'FORBIDDEN' });
      else expect((await created).id.startsWith(`${h.foreignId}:`)).toBe(true);
      await expect(
        commands().update(uid, {
          productId,
          expectedRevision: current.revision,
          form: current.form,
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(
        commands().setHqStock(uid, {
          productId,
          expectedVersion: current.hq.version,
          onHand: 1,
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }
    expect((await commands().read(h.users.hq, productId)).hq).toEqual(current.hq);
  });
});

describe('Review fix: product identity after a code change', () => {
  let h: LookupHarness;
  beforeEach(async () => {
    h = await createLookupHarness('products-fix');
  });
  afterEach(async () => {
    if (h) await h.dispose();
  });
  it('reuses a released product code for a new product', async () => {
    const commands = createProductAdminCommands(h.dc);
    const first = await commands.create(h.users.hq, {
      form: form({ sourceCode: 'X-1' }),
      hqOnHand: 1,
      idempotencyKey: randomUUID(),
    });
    await commands.update(h.users.hq, {
      productId: first.id,
      expectedRevision: first.revision,
      form: form({ sourceCode: 'Y-1' }),
      idempotencyKey: randomUUID(),
    });
    const second = await commands.create(h.users.hq, {
      form: form({ name: 'Druga', sourceCode: 'X-1' }),
      hqOnHand: 2,
      idempotencyKey: randomUUID(),
    });
    expect(second.id).not.toBe(first.id);
    expect(second.form.sourceCode).toBe('X-1');
  });
  it('lets the same HQ user save fields after their own alias changes on another product state', async () => {
    const commands = createProductAdminCommands(h.dc);
    const productId = h.productId('NBS-CEMENT-100');
    const loaded = await commands.read(h.users.hq, productId);
    const { createProductAliasCommands } = await import('../../functions/src/products/aliases.ts');
    await createProductAliasCommands(h.dc).save(h.users.hq, {
      productId,
      changes: [{ op: 'add', phrase: 'betonik', kind: 'NAME' }],
      idempotencyKey: randomUUID(),
    });
    const saved = await commands.update(h.users.hq, {
      productId,
      expectedRevision: loaded.revision,
      form: { ...loaded.form, name: 'Cement 2' },
      idempotencyKey: randomUUID(),
    });
    expect(saved.form.name).toBe('Cement 2');
    await expect(
      commands.update(h.users.hq, {
        productId,
        expectedRevision: loaded.revision,
        form: loaded.form,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'STALE_STATE' });
  });
});
