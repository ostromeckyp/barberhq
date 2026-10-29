import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extractPdf } from '../../functions/src/knowledge/extract.ts';
import { executeDelivery, type DeliveryHarness } from './delivery.ts';
import { randomUUID } from 'node:crypto';

/** Delivery owns its SQL fixture; PDF bytes are the shared geometry test asset. */
export async function seedDeliveryPdf(h: DeliveryHarness, label = 'v1') {
  const bytes = await readFile('tests/fixtures/pdf/geometry-two-pages.pdf'),
    extracted = await extractPdf(bytes);
  const documentId = `${h.businessId}:delivery-procedure`,
    versionId = `${documentId}:${label}`;
  await h.operator.executeGraphql(
    `mutation($businessId:String!,$documentId:String!,$versionId:String!,$hash:String!,$size:Int!,$count:Int!){
  ${label === 'v1' ? 'knowledgeDocument_insert(data:{id:$documentId,businessId:$businessId,documentCode:"DELIVERY-TEST",activeVersionId:$versionId})' : 'knowledgeDocument_update(key:{id:$documentId},data:{activeVersionId:$versionId})'}
  knowledgeVersion_insert(data:{id:$versionId,businessId:$businessId,documentId:$documentId,versionLabel:"${label}",title:"${label === 'v1' ? 'Delivery handling procedure' : 'Current delivery procedure'}",language:"pl",sourceType:SYNTHETIC_PROCEDURE,synthetic:true,sourceUrls:[],status:READY,pdfSha256:$hash,bucket:"test-private-bucket",objectPath:"delivery/geometry.pdf",objectGeneration:"1",contentType:"application/pdf",byteSize:$size,pageCount:$count,publishedAt:"2026-10-25T00:00:00Z",isActive:true})
 }`,
    {
      variables: {
        businessId: h.businessId,
        documentId,
        versionId,
        hash: createHash('sha256').update(bytes).digest('hex'),
        size: bytes.length,
        count: extracted.pages.length,
      },
    },
  );
  for (const page of extracted.pages)
    await h.operator.executeGraphql(
      `mutation($versionId:String!,$page:Int!,$text:String!,$markdown:String!,$spans:Any!,$viewBox:Any!,$unit:Float!,$rotation:Int!){
  knowledgePage_insert(data:{versionId:$versionId,physicalPage:$page,text:$text,markdown:$markdown,spans:$spans,quality:COMPLETE,reviewed:true,viewBox:$viewBox,userUnit:$unit,rotation:$rotation})
 }`,
      {
        variables: {
          versionId,
          page: page.physicalPage,
          text: page.text,
          markdown: page.markdown,
          spans: page.spans,
          viewBox: page.viewBox,
          unit: page.userUnit,
          rotation: page.rotation,
        },
      },
    );
  if (label === 'v1')
    await executeDelivery(h, 'hq', {
      type: 'SET_PROCEDURE',
      input: { kind: 'DAMAGED', documentId, expectedRevision: 0, idempotencyKey: randomUUID() },
    });
  return { bytes, documentId, versionId };
}
