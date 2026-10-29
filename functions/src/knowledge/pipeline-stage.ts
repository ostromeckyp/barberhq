import { validateKnowledgeProvenance } from './schemas.js';
import { createHash } from 'node:crypto';
import * as sql from '@barberhq/server';
import {
  metadataFromStorage,
  isSyntheticSource,
  legacySourceType,
  storageKind,
  storageOrigin,
} from '../../../shared/knowledge-metadata.js';
import { validatePdf } from './extract.js';
import { KnowledgeError } from './repository.js';
import { knowledgeIds } from './pipeline-scope.js';
import type { KnowledgePipeline } from './pipeline.js';
import type { ManifestEntry } from './models/manifest-entry.js';

export async function stageVersion(
  p: KnowledgePipeline,
  input: ManifestEntry,
  bytes: Uint8Array,
): Promise<string> {
  if (
    (input.publicationStatus !== 'demo-current' && input.publicationStatus !== 'retired') ||
    input.businessKey !== p.businessKey ||
    !/^[a-f0-9]{64}$/.test(input.sha256)
  )
    throw new KnowledgeError('INVALID_MANIFEST');
  if (input.version === 'v0' && input.publicationStatus !== 'retired')
    throw new KnowledgeError('INVALID_MANIFEST');
  const metadata = metadataFromStorage({ ...input, synthetic: isSyntheticSource(input) });
  try {
    validateKnowledgeProvenance({
      origin: metadata.origin,
      sourceUrls: input.sourceUrls,
      observedOn: input.observedOn,
    });
  } catch {
    throw new KnowledgeError('INVALID_MANIFEST');
  }
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== input.sha256) throw new KnowledgeError('PDF_HASH_MISMATCH');
  const { pageCount } = await validatePdf(bytes);
  const ids = knowledgeIds(p.businessId, input.documentId, input.version);
  const document = await p.repo.document(ids.documentId);
  if (document && document.nextVersionNumber == null)
    throw new KnowledgeError('VERSION_CONFLICT', 'Version cursor is uninitialized');
  const existing = await p.repo.version(ids.versionId);
  if (existing) {
    const classification = metadataFromStorage(existing);
    if (
      classification.kind !== metadata.kind ||
      classification.origin !== metadata.origin ||
      existing.pdfSha256 !== hash ||
      existing.byteSize !== bytes.length ||
      existing.pageCount !== pageCount ||
      existing.businessId !== p.businessId ||
      existing.documentId !== ids.documentId ||
      existing.publicationStatus !==
        (input.publicationStatus === 'retired' ? 'RETIRED' : 'DEMO_CURRENT')
    )
      throw new KnowledgeError('VERSION_CONFLICT');
    return ids.versionId;
  }
  const path = `knowledge/${p.businessId}/${input.documentId}/${input.version}/${hash}.pdf`;
  const original = await p.repo.putOriginal(path, bytes, hash);
  try {
    await p.repo.stage({
      businessId: p.businessId,
      documentId: ids.documentId,
      documentCode: input.documentId,
      versionId: ids.versionId,
      versionLabel: input.version,
      nextVersionNumber: Number(input.version.slice(1)) + 1,
      newDocument: !document,
      existingDocument: !!document,
      title: input.title,
      language: input.language,
      kind: storageKind(metadata.kind) as sql.KnowledgeDocumentKind,
      origin: storageOrigin(metadata.origin) as sql.KnowledgeOrigin,
      sourceType:
        (legacySourceType(metadata)
          ?.replaceAll('-', '_')
          .toUpperCase() as sql.KnowledgeSourceType) ?? null,
      publicationStatus:
        input.publicationStatus === 'retired'
          ? sql.KnowledgePublicationStatus.RETIRED
          : sql.KnowledgePublicationStatus.DEMO_CURRENT,
      synthetic: isSyntheticSource(metadata),
      sourceUrls: input.sourceUrls,
      observedOn: input.observedOn,
      bucket: original.bucket,
      objectPath: original.path,
      objectGeneration: original.generation,
      pdfSha256: hash,
      contentType: 'application/pdf',
      byteSize: bytes.length,
      pageCount,
    });
  } catch (error) {
    const raced = await p.repo.version(ids.versionId);
    if (
      raced?.pdfSha256 === hash &&
      metadataFromStorage(raced).kind === metadata.kind &&
      metadataFromStorage(raced).origin === metadata.origin &&
      raced.byteSize === bytes.length &&
      raced.publicationStatus ===
        (input.publicationStatus === 'retired' ? 'RETIRED' : 'DEMO_CURRENT')
    ) {
      const racedDocument = await p.repo.document(ids.documentId);
      if (racedDocument?.nextVersionNumber == null)
        throw new KnowledgeError('VERSION_CONFLICT', 'Version cursor is uninitialized');
      return ids.versionId;
    }
    if (raced) throw new KnowledgeError('VERSION_CONFLICT');
    throw error;
  }
  return ids.versionId;
}
