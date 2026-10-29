export type KnowledgeProfileRow = {
  version_id: string;
  business_id: string;
  product_id: string;
  proposed_type: string | null;
  approved_type: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
};
