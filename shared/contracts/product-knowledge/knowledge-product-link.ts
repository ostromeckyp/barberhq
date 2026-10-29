import type { KnowledgePassageRef } from './knowledge-passage-ref.js';
export type KnowledgeProductLink = {
  id: string;
  passage: KnowledgePassageRef;
  productId: string | null;
  candidateProductIds?: string[];
  method: 'code' | 'model' | 'hq';
  confirmed: boolean;
};
