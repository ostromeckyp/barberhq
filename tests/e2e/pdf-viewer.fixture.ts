import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extractPdf } from '../../functions/src/knowledge/extract.ts';
import { insertKnowledgePage, stageKnowledgeVersion } from '@barberhq/server';
import type {
  StageKnowledgeVersionVariables,
  InsertKnowledgePageVariables,
} from '@barberhq/server';
import { getSourceSection } from '@barberhq/browser';
import type { createCloudHarness } from '../support/cloud.ts';

type CloudHarness = Awaited<ReturnType<typeof createCloudHarness>>;

export async function seedPdfViewerSource(
  harness: CloudHarness,
  kind: 'geometry' | 'canonical' = 'geometry',
) {
  const bytes = await readFile(
    kind === 'geometry'
      ? 'tests/fixtures/pdf/geometry-two-pages.pdf'
      : 'data/knowledge/pdfs/DAM-001-v1.pdf',
  );
  const extracted = await extractPdf(bytes);
  const pdfSha256 = createHash('sha256').update(bytes).digest('hex');
  const page = extracted.pages[kind === 'geometry' ? 1 : 0];
  const documentCode = kind === 'geometry' ? 'GEOMETRY-TEST' : 'DAM-001';
  const documentId = `${harness.businessId}:${documentCode}`;
  const versionId = `${documentId}:v1`;
  const verifiedChunkId = `${versionId}:verified`;
  const unavailableChunkId = `${versionId}:unavailable`;
  await stageKnowledgeVersion(harness.operator, {
    businessId: harness.businessId,
    documentId,
    documentCode,
    versionId,
    versionLabel: 'v1',
    nextVersionNumber: 2,
    title:
      kind === 'geometry' ? 'Delivery evidence · Łódzka' : 'Damaged products in a salon delivery',
    language: 'en',
    sourceType: 'SYNTHETIC_PROCEDURE' as StageKnowledgeVersionVariables['sourceType'],
    kind: 'PROCEDURE' as StageKnowledgeVersionVariables['kind'],
    origin: 'SYNTHETIC' as StageKnowledgeVersionVariables['origin'],
    synthetic: true,
    sourceUrls: [],
    observedOn: null,
    bucket: 'test-private-bucket',
    objectPath: `tests/${versionId}.pdf`,
    objectGeneration: '1',
    pdfSha256,
    contentType: 'application/pdf',
    byteSize: bytes.byteLength,
    pageCount: extracted.pages.length,
  });
  for (const sourcePage of extracted.pages) {
    await insertKnowledgePage(harness.operator, {
      versionId,
      revision: 1,
      pdfSha256,
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
  const insertChunk = `mutation($id:String!,$versionId:String!,$physicalPage:Int!,$ordinal:Int!,$text:String!,$start:Int!,$end:Int!,$rects:Any!,$geometryStatus:KnowledgeGeometryStatus!,$embedding:Vector!) @auth(level:NO_ACCESS) {
    knowledgeChunk_insert(data:{id:$id,versionId:$versionId,physicalPage:$physicalPage,ordinal:$ordinal,sectionId:"delivery-evidence",heading:"Delivery evidence",text:$text,start:$start,end:$end,rects:$rects,geometryStatus:$geometryStatus,embedding:$embedding,embeddingModel:"test",embeddingDimension:768,embeddingConfigHash:"test"})
  }`;
  const firstSpanIndex =
    kind === 'geometry'
      ? 0
      : page.spans.findIndex((span) =>
          page.text.slice(span.start, span.end).includes('Do not mark an affected unit'),
        );
  if (firstSpanIndex < 0) throw new Error('Canonical PDF fixture lost the cited sentence.');
  const citedSpans = page.spans.slice(firstSpanIndex, firstSpanIndex + 2);
  const start = citedSpans[0].start;
  const end = citedSpans[citedSpans.length - 1].end;
  const excerpt = page.text.slice(start, end);
  for (const [id, ordinal, rects, geometryStatus] of [
    [verifiedChunkId, 0, citedSpans.map((span) => span.rect), 'VERIFIED'],
    [unavailableChunkId, 1, [], 'UNAVAILABLE'],
  ] as const) {
    await harness.operator.executeGraphql(insertChunk, {
      variables: {
        id,
        versionId,
        physicalPage: page.physicalPage,
        ordinal,
        text: excerpt,
        start,
        end,
        rects,
        geometryStatus,
        embedding: [1, ...Array(767).fill(0)],
      },
    });
  }
  const state = await harness.operator.executeGraphql<
    {
      knowledgeVersion: {
        businessId: string;
        status: string;
        publishedAt: string | null;
        chunks: { id: string }[];
      } | null;
    },
    { id: string }
  >(
    `query($id:String!) @auth(level:NO_ACCESS) {
    knowledgeVersion(id:$id) { businessId status publishedAt chunks:knowledgeChunks_on_version { id } }
  }`,
    { variables: { id: versionId } },
  );
  if (
    state.data.knowledgeVersion?.businessId !== harness.businessId ||
    !state.data.knowledgeVersion.chunks.some((chunk) => chunk.id === verifiedChunkId)
  )
    throw new Error(
      `PDF test source was not seeded: ${JSON.stringify(state.data.knowledgeVersion)}`,
    );
  await getSourceSection(harness.browserClient('hq'), { versionId, chunkId: verifiedChunkId });
  return {
    bytes,
    versionId,
    verifiedChunkId,
    unavailableChunkId,
    excerpt,
    physicalPage: page.physicalPage,
  };
}
