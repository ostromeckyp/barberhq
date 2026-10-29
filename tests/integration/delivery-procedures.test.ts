import { afterEach, beforeEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { executeQuery, queryRef } from 'firebase/data-connect';
import type { DeliveryProblemKind } from '../../shared/contracts/delivery.ts';
import { resolveDeliveryProcedures } from '../../functions/src/delivery/procedures.ts';
import {
  createDeliveryHarness,
  executeDelivery,
  readDeliverySnapshot,
  seedDispatchedDelivery,
  type DeliveryHarness,
} from '../support/delivery.ts';
let h: DeliveryHarness;
beforeEach(async () => {
  h = undefined!;
  h = await createDeliveryHarness('delivery-procedures');
});
afterEach(async () => {
  if (h) await h.dispose();
});
async function source(input: { foreign?: boolean; published?: boolean } = {}) {
  const documentId = randomUUID(),
    versionId = randomUUID();
  let businessId = h.businessId;
  if (input.foreign)
    businessId = (
      (
        await h.operator.executeGraphql(
          'query($uid:String!){membership(key:{uid:$uid}){businessId}}',
          { variables: { uid: h.users.foreign } },
        )
      ).data as { membership: { businessId: string } }
    ).membership.businessId;
  await h.operator.executeGraphql(
    `mutation($businessId:String!,$documentId:String!,$versionId:String!,$publishedAt:Timestamp){
  knowledgeDocument_insert(data:{id:$documentId,businessId:$businessId,documentCode:$documentId,activeVersionId:$versionId})
  knowledgeVersion_insert(data:{id:$versionId,documentId:$documentId,businessId:$businessId,versionLabel:"1",title:"Receiving procedure",language:"pl",sourceType:SYNTHETIC_PROCEDURE,synthetic:true,sourceUrls:[],status:READY,pdfSha256:"fixture",publishedAt:$publishedAt,isActive:true})
 }`,
    {
      variables: {
        businessId,
        documentId,
        versionId,
        publishedAt: input.published === false ? null : '2026-10-25T00:00:00Z',
      },
    },
  );
  return { documentId, versionId };
}
const set = (
  kind: DeliveryProblemKind,
  documentId: string | null,
  expectedRevision: number,
  key = randomUUID(),
  role: keyof DeliveryHarness['users'] = 'hq',
) =>
  executeDelivery(h, role, {
    type: 'SET_PROCEDURE',
    input: { kind, documentId, expectedRevision, idempotencyKey: key },
  });
async function bindingRows() {
  return (
    await h.operator.executeGraphql(
      'query($businessId:String!){deliveryProcedureBindings(where:{businessId:{eq:$businessId}},orderBy:{kind:ASC}){kind documentId revision}}',
      { variables: { businessId: h.businessId } },
    )
  ).data;
}
it('hq_maps_current_published_document_and_salon_resolves_without_ai', async () => {
  const { requestId } = await seedDispatchedDelivery(h),
    doc = await source();
  expect(await set('DAMAGED', doc.documentId, 0)).toMatchObject({
    bindingRevision: 1,
    replayed: false,
  });
  expect(
    await resolveDeliveryProcedures(h.operator, h.users.legnicka, requestId, [
      'DAMAGED',
      'MISSING',
    ]),
  ).toEqual([
    {
      kind: 'DAMAGED',
      documentId: doc.documentId,
      revision: 1,
      availability: 'AVAILABLE',
      reference: { kind: 'DAMAGED', versionId: doc.versionId },
      title: 'Receiving procedure',
    },
    {
      kind: 'MISSING',
      documentId: null,
      revision: 0,
      availability: 'MISSING',
      reference: null,
      title: null,
    },
  ]);
});
it('revoked_procedure_during_draft_is_unavailable_and_does_not_block_facts', async () => {
  const { requestId, items } = await seedDispatchedDelivery(h),
    doc = await source();
  await set('DAMAGED', doc.documentId, 0);
  await h.operator.executeGraphql(
    'mutation($id:String!){knowledgeVersion_update(id:$id,data:{revokedAt:"2026-10-25T01:00:00Z"})}',
    { variables: { id: doc.versionId } },
  );
  expect(
    await resolveDeliveryProcedures(h.operator, h.users.legnicka, requestId, ['DAMAGED']),
  ).toEqual([
    {
      kind: 'DAMAGED',
      documentId: doc.documentId,
      revision: 1,
      availability: 'UNAVAILABLE',
      reference: null,
      title: null,
    },
  ]);
  await executeDelivery(h, 'legnicka', {
    type: 'RECORD_RECEIPT',
    input: {
      requestId,
      expectedRevision: 3,
      idempotencyKey: randomUUID(),
      items: [
        { productId: items[0].productId, goodQuantity: 8, damagedQuantity: 2, missingQuantity: 0 },
      ],
      report: { description: 'Damaged, source currently unavailable', batchIdentifier: null },
      procedureReferences: [],
    },
  });
  expect((await readDeliverySnapshot(h)).salonInventory.onHand).toBe(10);
});
it('disable_retains_revision_and_retry_is_immutable', async () => {
  const doc = await source(),
    key = randomUUID(),
    first = await set('DAMAGED', doc.documentId, 0, key);
  expect(await set('DAMAGED', doc.documentId, 0, key)).toEqual({ ...first, replayed: true });
  await set('DAMAGED', null, 1);
  expect(await bindingRows()).toMatchObject({
    deliveryProcedureBindings: [{ kind: 'DAMAGED', documentId: null, revision: 2 }],
  });
  await expect(set('DAMAGED', doc.documentId, 0)).rejects.toMatchObject({ code: 'STALE_STATE' });
  await set('DAMAGED', doc.documentId, 2);
  expect(await bindingRows()).toMatchObject({ deliveryProcedureBindings: [{ revision: 3 }] });
});
it('foreign_or_unpublished_binding_and_non_hq_write_are_denied', async () => {
  for (const settings of [{ foreign: true }, { published: false }]) {
    const doc = await source(settings),
      before = await bindingRows();
    await expect(set('MISSING', doc.documentId, 0)).rejects.toThrow();
    expect(await bindingRows()).toEqual(before);
  }
  const doc = await source();
  await expect(set('MISSING', doc.documentId, 0, randomUUID(), 'legnicka')).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
});
it('resolver_rejects_other_salon_foreign_and_unassigned_scope', async () => {
  const { requestId } = await seedDispatchedDelivery(h);
  for (const role of ['lodzka', 'foreign', 'unassigned'] as const)
    await expect(
      resolveDeliveryProcedures(h.operator, h.users[role], requestId, ['DAMAGED']),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
});
it('superseding_document_selects_new_version_and_keeps_old_reference_readable', async () => {
  const { requestId, items } = await seedDispatchedDelivery(h),
    doc = await source();
  await set('DAMAGED', doc.documentId, 0);
  const v2 = randomUUID();
  await h.operator.executeGraphql(
    `mutation($documentId:String!,$old:String!,$v2:String!,$businessId:String!){
  knowledgeVersion_update(id:$old,data:{isActive:false,publicationStatus:RETIRED})
  knowledgeVersion_insert(data:{id:$v2,documentId:$documentId,businessId:$businessId,versionLabel:"2",title:"Updated procedure",language:"pl",sourceType:SYNTHETIC_PROCEDURE,synthetic:true,sourceUrls:[],status:READY,pdfSha256:"fixture-v2",publishedAt:"2026-10-25T02:00:00Z",isActive:true})
  knowledgeDocument_update(id:$documentId,data:{activeVersionId:$v2})
 }`,
    { variables: { documentId: doc.documentId, old: doc.versionId, v2, businessId: h.businessId } },
  );
  expect(
    (await resolveDeliveryProcedures(h.operator, h.users.legnicka, requestId, ['DAMAGED']))[0]
      .reference?.versionId,
  ).toBe(v2);
  const recorded = await executeDelivery(h, 'legnicka', {
    type: 'RECORD_RECEIPT',
    input: {
      requestId,
      expectedRevision: 3,
      idempotencyKey: randomUUID(),
      items: [
        { productId: items[0].productId, goodQuantity: 8, damagedQuantity: 2, missingQuantity: 0 },
      ],
      report: {
        description: 'Already consulted previous published version',
        batchIdentifier: null,
      },
      procedureReferences: [{ kind: 'DAMAGED', versionId: doc.versionId }],
    },
  });
  expect(recorded.receiptId).toBeTruthy();
});
it('hq_document_choices_exclude_foreign_and_unpublished_sources', async () => {
  const current = await source(),
    unpublished = await source({ published: false }),
    foreign = await source({ foreign: true });
  await set('DAMAGED', current.documentId, 0);
  const docs = await executeQuery(
    queryRef<Record<string, unknown>, Record<string, unknown>>(
      h.browserClient('hq'),
      'ListDeliveryProcedureDocuments',
      { limit: 20, offset: 0 },
    ),
  );
  const serialized = JSON.stringify(docs.data);
  expect(serialized).toContain(current.documentId);
  expect(serialized).not.toContain(unpublished.documentId);
  expect(serialized).not.toContain(foreign.documentId);
  const bindings = await executeQuery(
    queryRef<Record<string, unknown>, Record<string, unknown>>(
      h.browserClient('hq'),
      'GetDeliveryProcedureBindings',
      {},
    ),
  );
  expect(JSON.stringify(bindings.data)).toContain(current.versionId);
  await expect(
    executeQuery(
      queryRef(h.browserClient('legnicka'), 'ListDeliveryProcedureDocuments', {
        limit: 20,
        offset: 0,
      }),
    ),
  ).rejects.toThrow(/FORBIDDEN/);
});
