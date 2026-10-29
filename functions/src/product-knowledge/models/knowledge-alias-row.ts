export type KnowledgeAliasRow = {
  id: string;
  business_id: string;
  product_id: string;
  salon_id: null;
  phrase: string;
  normalized: string;
  kind: 'NAME' | 'TYPE' | 'PHONETIC';
  lang: 'pl' | 'en';
  source: 'GENERATED' | 'HQ';
  status: 'PROPOSED' | 'REJECTED' | 'ACTIVE' | 'RETIRED';
  ambiguous: boolean;
  source_document_version_id: string;
  created_by: string;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  generation_id: string | null;
};
