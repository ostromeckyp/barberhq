export interface KnowledgePageRecord {
  physicalPage: number;
  text: string;
  markdown: string;
  spans: unknown;
  printedLabel: string | null;
  quality: 'COMPLETE' | 'NEEDS_REVIEW';
  reviewed: boolean;
  viewBox: unknown;
  userUnit: number;
  rotation: number;
}
