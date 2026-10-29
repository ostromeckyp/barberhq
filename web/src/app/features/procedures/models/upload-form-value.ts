import type {
  KnowledgeDocumentKind,
  KnowledgeOrigin,
} from '../../../../../../shared/contracts/knowledge/index';

export type UploadFormValue = {
  title: string;
  language: 'en' | 'pl';
  kind: KnowledgeDocumentKind;
  origin: KnowledgeOrigin;
  sourceUrls: string;
  observedOn: string;
};
