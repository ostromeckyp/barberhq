import type { KnowledgePassageRef } from './knowledge-passage-ref.js';
export type LinkSuggestion = {
  passage: KnowledgePassageRef;
  productIds: string[];
  method: 'code' | 'model';
  confirmed: false;
};
