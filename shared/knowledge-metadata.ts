import type {
  KnowledgeDocumentKind,
  KnowledgeOrigin,
  KnowledgeMetadata,
  LegacyCreateDocumentInput,
} from './contracts/knowledge/index.js';

export const knowledgeKinds: readonly KnowledgeDocumentKind[] = [
  'procedure',
  'policy',
  'product-card',
  'product-catalog',
];
export const knowledgeOrigins: readonly KnowledgeOrigin[] = [
  'official',
  'public-compilation',
  'synthetic',
];
export const storageKind = (kind: KnowledgeDocumentKind): string =>
  kind.replaceAll('-', '_').toUpperCase();
export const storageOrigin = (origin: KnowledgeOrigin): string =>
  origin.replaceAll('-', '_').toUpperCase();

export function metadataFromLegacy(
  sourceType: LegacyCreateDocumentInput['sourceType'],
): KnowledgeMetadata {
  switch (sourceType) {
    case 'synthetic-procedure':
      return { kind: 'procedure', origin: 'synthetic' };
    case 'public-product-summary':
      return { kind: 'product-catalog', origin: 'public-compilation' };
    default:
      throw new Error('Unknown legacy knowledge classification');
  }
}
export function legacySourceType(
  metadata: KnowledgeMetadata,
): LegacyCreateDocumentInput['sourceType'] | null {
  if (metadata.kind === 'procedure' && metadata.origin === 'synthetic')
    return 'synthetic-procedure';
  if (metadata.kind === 'product-catalog' && metadata.origin === 'public-compilation')
    return 'public-product-summary';
  return null;
}
export function metadataFromStorage(record: unknown): KnowledgeMetadata {
  if (!record || typeof record !== 'object') throw new Error('Missing knowledge metadata');
  const row = record as Record<string, unknown>;
  const legacy = row['sourceType'] ?? row['source_type'];
  const translated =
    legacy == null
      ? null
      : legacy === 'SYNTHETIC_PROCEDURE' || legacy === 'synthetic-procedure'
        ? 'synthetic-procedure'
        : legacy === 'PUBLIC_PRODUCT_SUMMARY' || legacy === 'public-product-summary'
          ? 'public-product-summary'
          : undefined;
  if (translated === undefined) throw new Error('Unknown legacy knowledge classification');
  let metadata: KnowledgeMetadata;
  if (row['kind'] == null && row['origin'] == null) {
    if (translated === null) throw new Error('Missing knowledge classification');
    metadata = metadataFromLegacy(translated);
  } else {
    const kind = knowledgeKinds.find((k) => row['kind'] === k || row['kind'] === storageKind(k));
    const origin = knowledgeOrigins.find(
      (o) => row['origin'] === o || row['origin'] === storageOrigin(o),
    );
    if (!kind || !origin) throw new Error('Invalid or partial knowledge classification');
    metadata = { kind, origin };
    if (translated !== null && legacySourceType(metadata) !== translated)
      throw new Error('Conflicting legacy knowledge classification');
  }
  if (typeof row['synthetic'] !== 'boolean' || row['synthetic'] !== isSyntheticSource(metadata))
    throw new Error('Conflicting synthetic knowledge flag');
  return metadata;
}
export function isSyntheticSource(metadata: KnowledgeMetadata): boolean {
  return metadata.origin === 'synthetic';
}
export function knowledgeProvenanceLabel(metadata: KnowledgeMetadata): string {
  const kind = metadata.kind.replaceAll('-', ' ');
  switch (metadata.origin) {
    case 'synthetic':
      return `Synthetic demo ${kind}`;
    case 'official':
      return `Official ${kind}`;
    case 'public-compilation':
      return `Unofficial public ${kind} compilation`;
  }
}
