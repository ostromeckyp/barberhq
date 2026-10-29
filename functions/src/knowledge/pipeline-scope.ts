import { KnowledgeError } from './repository.js';
import type { KnowledgePipeline } from './pipeline.js';

export function knowledgeIds(businessId: string, documentCode: string, version: string) {
  if (!/^[A-Z0-9-]{3,64}$/.test(documentCode) || !/^v(?:0|[1-9][0-9]*)$/.test(version))
    throw new KnowledgeError('INVALID_ID');
  const documentId = `${businessId}:${documentCode}`;
  return { documentId, versionId: `${documentId}:${version}` };
}

export async function scopedVersion(p: KnowledgePipeline, id: string) {
  const version = await p.repo.version(id);
  if (!version || version.businessId !== p.businessId) throw new KnowledgeError('NOT_FOUND');
  return version;
}
