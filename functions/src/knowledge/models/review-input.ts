export type ReviewInput = {
  versionId: string;
  pdfSha256: string;
  extractionHash: string;
  reviewedPhysicalPages: number[];
  approvalText: string;
  approvedAt: string;
};
