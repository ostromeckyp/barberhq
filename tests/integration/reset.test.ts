import { beforeEach, afterEach, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createCloudHarness } from '../support/cloud.ts';
import { StockRepository } from '../../functions/src/stock/repository.ts';
import { resetDemo, resetRecords } from '../../scripts/seed/reset.ts';
let h: Awaited<ReturnType<typeof createCloudHarness>>;
beforeEach(async () => {
  h = await createCloudHarness('reset');
});
afterEach(async () => {
  if (h) await h.dispose();
});
async function snapshot() {
  return (
    await h.operator.executeGraphql(
      'query($id:String!){inventories(where:{location:{businessId:{eq:$id}}},orderBy:[{locationId:ASC},{productId:ASC}]){locationId productId onHand reserved version}memberships(where:{businessId:{eq:$id}}){uid}products(where:{businessId:{eq:$id}}){id}replenishmentRequests(where:{businessId:{eq:$id}}){id}activeRequests(where:{businessId:{eq:$id}}){requestId}}',
      { variables: { id: h.businessId } },
    )
  ).data;
}
it('reset_refuses_foreign_target_and_restores_seed', async () => {
  await new StockRepository(h.operator).execute(h.users.legnicka, {
    type: 'SUBMIT',
    input: {
      salonId: h.legnickaId,
      items: [{ productId: `${h.businessId}:NBS-MATOWA-100`, quantity: 2 }],
      idempotencyKey: randomUUID(),
    },
  });
  await h.setInventory('hq', 'NBS-MATOWA-100', 7);
  const before = await snapshot();
  await expect(
    resetDemo({
      projectId: 'foreign',
      businessKey: h.businessId,
      confirmBusinessKey: h.businessId,
      dryRun: false,
      quiescent: true,
    }),
  ).rejects.toThrow();
  expect(await snapshot()).toEqual(before);
  await resetRecords(h.operator, h.businessId, true);
  expect(await snapshot()).toEqual(before);
  await h.seedAgain();
  expect((await h.inventory()).hqOnHand).toBe(7);
  await resetRecords(h.operator, h.businessId, false);
  expect((await h.inventory()).hqOnHand).toBe(18);
  const after = (await snapshot()) as {
    memberships: unknown[];
    products: unknown[];
    activeRequests: unknown[];
    replenishmentRequests: unknown[];
  };
  expect(after.activeRequests).toEqual([]);
  expect(after.replenishmentRequests).toEqual([]);
  expect(after.memberships).toEqual((before as typeof after).memberships);
  expect(after.products).toEqual((before as typeof after).products);
});

it('reset_removes_scoped_delivery_operations_but_preserves_procedure_bindings_and_knowledge', async () => {
  const { openDeliveryIssue, executeDelivery, readDeliverySnapshot } =
    await import('../support/delivery.ts');
  if (process.env.BARBERHQ_TEST_MODE !== 'emulator' || process.env.BARBERHQ_TEST_CONFIG)
    throw new Error('Local delivery fixtures only');
  const root = await openDeliveryIssue(h),
    documentId = `${h.businessId}:procedure`,
    versionId = `${documentId}:v1`;
  await h.operator.executeGraphql(
    `mutation($businessId:String!,$documentId:String!,$versionId:String!){knowledgeDocument_insert(data:{id:$documentId,businessId:$businessId,documentCode:"RESET-PROCEDURE",activeVersionId:$versionId}) knowledgeVersion_insert(data:{id:$versionId,businessId:$businessId,documentId:$documentId,versionLabel:"v1",title:"Keep procedure",language:"pl",sourceType:SYNTHETIC_PROCEDURE,synthetic:true,sourceUrls:[],status:READY,pdfSha256:"preserved-original-sha",bucket:"private-fixture",objectPath:"original.pdf",objectGeneration:"1",publishedAt:"2026-10-25T00:00:00Z",isActive:true})}`,
    { variables: { businessId: h.businessId, documentId, versionId } },
  );
  await executeDelivery(h, 'hq', {
    type: 'SET_PROCEDURE',
    input: { kind: 'DAMAGED', documentId, expectedRevision: 0, idempotencyKey: randomUUID() },
  });
  await executeDelivery(h, 'hq', {
    type: 'CREATE_REPLACEMENT',
    input: { issueId: root.issueId, expectedRevision: 1, idempotencyKey: randomUUID() },
  });
  const protectedRows = async () =>
    (
      await h.operator.executeGraphql(
        'query($id:String!){bindings:deliveryProcedureBindings(where:{businessId:{eq:$id}}){kind documentId revision updatedAt}versions:knowledgeVersions(where:{businessId:{eq:$id}}){id title pdfSha256 bucket objectPath objectGeneration publishedAt}documents:knowledgeDocuments(where:{businessId:{eq:$id}}){id activeVersionId}settings:salonSettingss(where:{salon:{businessId:{eq:$id}}},orderBy:{salonId:ASC}){salonId version lowStockThreshold}}',
        { variables: { id: h.businessId } },
      )
    ).data;
  const protectedBefore = await protectedRows(),
    before = await readDeliverySnapshot(h);
  const dry = await resetRecords(h.operator, h.businessId, true);
  expect(dry.deletedOperationalRows).toBeGreaterThan(
    before.requests.length +
      before.actionReceipts.length +
      before.movements.length +
      before.keys.length,
  );
  const applied = await resetRecords(h.operator, h.businessId, false);
  expect(applied.deletedOperationalRows).toBe(dry.deletedOperationalRows);
  const after = await readDeliverySnapshot(h);
  expect(after.receipts).toEqual([]);
  expect(after.receiptItems).toEqual([]);
  expect(after.issues).toEqual([]);
  expect(after.events).toEqual([]);
  expect(after.keys).toEqual([]);
  expect(after.commands.filter((row) => row.type !== 'SET_PROCEDURE')).toEqual([]);
  expect(after.requests).toEqual([]);
  expect(after.movements).toEqual([]);
  expect(await protectedRows()).toEqual(protectedBefore);
});

it('reset_restores_the_product_baseline_and_seed_never_overwrites_hq_edits_outside_reset', async () => {
  const { readFileSync } = await import('node:fs');
  const { createProductAdminCommands } = await import('../../functions/src/products/commands.ts');
  const { createProductAliasCommands } = await import('../../functions/src/products/aliases.ts');
  const { runProductAliasSeed, readAliasSeed, readAliasSeedState } =
    await import('../../scripts/seed/product-aliases.ts');
  const { seedRecords } = await import('../../scripts/seed/business.ts');
  const { validateSeed } = await import('../../scripts/prepare-data/catalog.ts');
  const aliasFile = readAliasSeed();
  await runProductAliasSeed(h.operator, aliasFile, h.businessId, true);
  const admin = createProductAdminCommands(h.operator);
  const aliases = createProductAliasCommands(h.operator);
  const cement = `${h.businessId}:NBS-CEMENT-100`;
  const added = await admin.create(h.users.hq, {
    form: { ...(await admin.read(h.users.hq, cement)).form, name: 'Nowy', sourceCode: 'NEW-1' },
    hqOnHand: 3,
    idempotencyKey: randomUUID(),
  });
  const current = await admin.read(h.users.hq, cement);
  await admin.update(h.users.hq, {
    productId: cement,
    expectedRevision: current.revision,
    form: { ...current.form, name: 'Cement HQ', type: 'pasta' },
    idempotencyKey: randomUUID(),
  });
  await admin.setHqStock(h.users.hq, {
    productId: cement,
    expectedVersion: current.hq.version,
    onHand: 40,
    idempotencyKey: randomUUID(),
  });
  const seeded = (await aliases.list(h.users.hq, cement)).aliases.find(
    (a) => a.phrase === 'cement',
  )!;
  await aliases.save(h.users.hq, {
    productId: cement,
    changes: [
      { op: 'remove', aliasId: seeded.id, expectedRevision: seeded.revision },
      { op: 'add', phrase: 'betonik', kind: 'PHONETIC' },
    ],
    idempotencyKey: randomUUID(),
  });
  const seed = validateSeed(JSON.parse(readFileSync('data/seed/business.json', 'utf8')));
  await seedRecords(
    h.operator,
    seed,
    h.businessId,
    [{ uid: h.users.hq, role: 'HQ', salonKeys: [] }],
    false,
  );
  expect((await admin.read(h.users.hq, cement)).form.name).toBe('Cement HQ');

  await resetRecords(h.operator, h.businessId, false);
  const after = await h.operator.executeGraphql<
    {
      products: { id: string; name: string; hqUpdatedAt: string | null; seedType: string | null }[];
      productAliases: { phrase: string; source: string; status: string; overriddenByHq: boolean }[];
      hqStockAdjustments: { id: string }[];
      productAdminOperations: { id: string }[];
    },
    { id: string; p: string }
  >(
    'query($id:String!,$p:String!){products(where:{businessId:{eq:$id}},orderBy:{id:ASC}){id name hqUpdatedAt seedType} productAliases(where:{productId:{eq:$p}},orderBy:{phrase:ASC}){phrase source status overriddenByHq} hqStockAdjustments(where:{businessId:{eq:$id}}){id} productAdminOperations(where:{businessId:{eq:$id}}){id}}',
    { variables: { id: h.businessId, p: cement } },
  );
  const data = after.data;
  expect(data.products.map((p) => p.id)).not.toContain(added.id);
  expect(data.products).toHaveLength(6);
  expect(data.products.every((p) => p.hqUpdatedAt === null)).toBe(true);
  expect(data.products.find((p) => p.id === cement)).toMatchObject({
    name: 'Pomada Cement',
    seedType: 'pomada',
  });
  expect(data.productAliases.map((a) => [a.phrase, a.source, a.status, a.overriddenByHq])).toEqual([
    ['cement', 'SEED', 'ACTIVE', false],
    ['cement pomade', 'SEED', 'ACTIVE', false],
  ]);
  expect(data.hqStockAdjustments).toEqual([]);
  expect(data.productAdminOperations).toEqual([]);
  expect((await admin.read(h.users.hq, cement)).hq.onHand).toBe(18);
  expect(
    (await readAliasSeedState(h.operator, h.businessId)).aliases.every(
      (a) => a.status === 'ACTIVE',
    ),
  ).toBe(true);
});
