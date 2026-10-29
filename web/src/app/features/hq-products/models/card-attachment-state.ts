import type { CardSuggestion } from './card-suggestion';

export type CardAttachmentState = {
  documentId: string;
  versionId: string;
  status: 'UPLOADING' | 'GENERATING' | 'PUBLISHING' | 'PUBLISHED' | 'NEEDS_REVIEW' | 'FAILED';
  suggestions: CardSuggestion[];
};
