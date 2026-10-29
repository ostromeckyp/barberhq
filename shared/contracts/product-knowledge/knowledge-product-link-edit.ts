import type { KnowledgePassageRef } from './knowledge-passage-ref.js';
export type KnowledgeProductLinkEdit = {
  id?: string;
  passage: KnowledgePassageRef;
  productId: string | null;
  confirmed: boolean;
};
