import type { CardStatus } from './card-status.js';
import type { CardSuggestion } from './card-suggestion.js';

export type CardAttachmentState = {
  documentId: string;
  versionId: string;
  status: CardStatus;
  suggestions: CardSuggestion[];
};
