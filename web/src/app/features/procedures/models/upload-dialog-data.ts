import type { DocumentRow } from '../../../../../../shared/contracts/knowledge/index';

export type UploadDialogData = {
  resume?: DocumentRow;
  replaceTarget?: Pick<DocumentRow, 'documentId' | 'documentRevision' | 'title' | 'version'> &
    Partial<Pick<DocumentRow, 'language' | 'kind' | 'origin' | 'sourceUrls' | 'observedOn'>>;
};
