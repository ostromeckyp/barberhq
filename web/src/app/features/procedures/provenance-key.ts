import type { KnowledgeMetadata } from '../../../../../shared/contracts/knowledge/index';

const provenanceKeys = {
  synthetic: {
    procedure: 'procedures.provenance.synthetic.procedure',
    policy: 'procedures.provenance.synthetic.policy',
    'product-card': 'procedures.provenance.synthetic.productCard',
    'product-catalog': 'procedures.provenance.synthetic.productCatalog',
  },
  official: {
    procedure: 'procedures.provenance.official.procedure',
    policy: 'procedures.provenance.official.policy',
    'product-card': 'procedures.provenance.official.productCard',
    'product-catalog': 'procedures.provenance.official.productCatalog',
  },
  'public-compilation': {
    procedure: 'procedures.provenance.publicCompilation.procedure',
    policy: 'procedures.provenance.publicCompilation.policy',
    'product-card': 'procedures.provenance.publicCompilation.productCard',
    'product-catalog': 'procedures.provenance.publicCompilation.productCatalog',
  },
} as const;

/** Translation key of the provenance label for a document's kind and origin. */
export function provenanceKey(metadata: KnowledgeMetadata): string {
  return provenanceKeys[metadata.origin][metadata.kind];
}
