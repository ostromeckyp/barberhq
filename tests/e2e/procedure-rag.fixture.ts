import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extractPdf } from '../../functions/src/knowledge/extract.ts';
import { insertKnowledgePage, stageKnowledgeVersion } from '@barberhq/server';
import type {
  InsertKnowledgePageVariables,
  StageKnowledgeVersionVariables,
} from '@barberhq/server';
import type { SourceSection } from '../../shared/contracts/knowledge.ts';
import type { createCloudHarness } from '../support/cloud.ts';

type Harness = Awaited<ReturnType<typeof createCloudHarness>>;

/** A private, isolated PDF source for the UI citation fixture. This does not run a model. */
export async function seedProcedureCitation(harness: Harness) {
  const bytes = await readFile('data/knowledge/pdfs/DAM-001-v1.pdf');
  const extracted = await extractPdf(bytes);
  const page = extracted.pages[0];
  const spanIndex = page.spans.findIndex((span) =>
    page.text.slice(span.start, span.end).includes('Do not mark an affected unit'),
  );
  if (spanIndex < 0) throw new Error('Procedure PDF fixture lost its cited passage.');
  const spans = page.spans.slice(spanIndex, spanIndex + 2);
  const excerpt = page.text.slice(spans[0].start, spans[spans.length - 1].end);
  const documentCode = 'DAM-001';
  const documentId = `${harness.businessId}:${documentCode}`;
  const versionId = `${documentId}:v1`;
  const chunkId = `${versionId}:cited`;
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const objectPath = `knowledge/${harness.businessId}/${documentCode}/v1/${sha256}.pdf`;
  await stageKnowledgeVersion(harness.operator, {
    businessId: harness.businessId,
    documentId,
    documentCode,
    versionId,
    versionLabel: 'v1',
    nextVersionNumber: 2,
    title: 'Damaged products in a salon delivery',
    language: 'en',
    sourceType: 'SYNTHETIC_PROCEDURE' as StageKnowledgeVersionVariables['sourceType'],
    kind: 'PROCEDURE' as StageKnowledgeVersionVariables['kind'],
    origin: 'SYNTHETIC' as StageKnowledgeVersionVariables['origin'],
    synthetic: true,
    sourceUrls: [],
    observedOn: null,
    bucket: 'test-private-bucket',
    objectPath,
    objectGeneration: '1',
    pdfSha256: sha256,
    contentType: 'application/pdf',
    byteSize: bytes.byteLength,
    pageCount: extracted.pages.length,
  });
  for (const sourcePage of extracted.pages) {
    await insertKnowledgePage(harness.operator, {
      versionId,
      revision: 1,
      pdfSha256: sha256,
      leaseId: null,
      physicalPage: sourcePage.physicalPage,
      text: sourcePage.text,
      markdown: sourcePage.markdown,
      spans: sourcePage.spans,
      quality: 'COMPLETE' as InsertKnowledgePageVariables['quality'],
      viewBox: sourcePage.viewBox,
      userUnit: sourcePage.userUnit,
      rotation: sourcePage.rotation,
    });
  }
  await harness.operator.executeGraphql(
    `mutation($id:String!,$versionId:String!,$physicalPage:Int!,$text:String!,$start:Int!,$end:Int!,$rects:Any!,$embedding:Vector!) @auth(level:NO_ACCESS) {
      knowledgeChunk_insert(data:{id:$id,versionId:$versionId,physicalPage:$physicalPage,ordinal:0,sectionId:"delivery-evidence",heading:"Delivery evidence",text:$text,start:$start,end:$end,rects:$rects,geometryStatus:VERIFIED,embedding:$embedding,embeddingModel:"test",embeddingDimension:768,embeddingConfigHash:"test"})
    }`,
    {
      variables: {
        id: chunkId,
        versionId,
        physicalPage: page.physicalPage,
        text: excerpt,
        start: spans[0].start,
        end: spans[spans.length - 1].end,
        rects: spans.map((span) => span.rect),
        embedding: [1, ...Array(767).fill(0)],
      },
    },
  );
  const source: SourceSection = {
    businessId: harness.businessId,
    documentId,
    versionId,
    version: 'v1',
    title: 'Damaged products in a salon delivery',
    language: 'en',
    synthetic: true,
    kind: 'procedure',
    origin: 'synthetic',
    superseded: false,
    pageCount: extracted.pages.length,
    chunkId,
    sourceSectionId: chunkId,
    sectionId: 'delivery-evidence',
    physicalPage: page.physicalPage,
    excerpt,
    geometry: { viewBox: page.viewBox, userUnit: page.userUnit, rotation: page.rotation },
    rects: spans.map((span) => span.rect),
    geometryStatus: 'VERIFIED',
  };
  return { bytes, source };
}
