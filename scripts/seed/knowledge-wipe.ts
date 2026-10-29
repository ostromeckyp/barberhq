import type { DataConnect } from 'firebase-admin/data-connect';
import type { getStorage } from 'firebase-admin/storage';
import { readKnowledgeWipeCounts } from '@barberhq/server';

export type Bucket = ReturnType<ReturnType<typeof getStorage>['bucket']>;
export type WipeCounts = {
  documents: number;
  versions: number;
  chunks: number;
  cardAttachments: number;
  documentAliases: number;
  storageObjects: number;
};

/** Removes every knowledge row and stored original of one business (demo reset only). */
export async function wipeKnowledge(
  dc: DataConnect,
  bucket: Bucket,
  businessId: string,
  dryRun: boolean,
): Promise<WipeCounts> {
  const { data } = await readKnowledgeWipeCounts(dc, { businessId });
  const [files] = await bucket.getFiles({ prefix: `knowledge/${businessId}/` });
  const counts: WipeCounts = {
    documents: data.documents[0]?._count ?? 0,
    versions: data.versions[0]?._count ?? 0,
    chunks: data.chunks[0]?._count ?? 0,
    cardAttachments: data.cardAttachments[0]?._count ?? 0,
    documentAliases: data.documentAliases[0]?._count ?? 0,
    storageObjects: files.length,
  };
  if (dryRun) return counts;
  await dc.executeMutation('WipeDemoKnowledge', { businessId });
  for (const file of files)
    await file.delete().catch((error: { code?: number }) => {
      if (error?.code !== 404) throw error;
    });
  return counts;
}
