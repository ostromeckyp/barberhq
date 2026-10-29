export type KnowledgeLinkRow = {
  id: string;
  version_id: string;
  business_id: string;
  product_id: string | null;
  chunk_id: string;
  start: number;
  end: number;
  extraction_hash: string;
  candidate_product_ids: string[];
  method: 'hq' | 'code' | 'model';
  confirmed: boolean;
  created_by: string;
  created_at: string;
};
