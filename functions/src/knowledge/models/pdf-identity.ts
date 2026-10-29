export type PdfIdentity = {
  id: string;
  businessId: string;
  status: string;
  publishedAt: string | null;
  revokedAt: string | null;
  bucket: string | null;
  objectPath: string | null;
  objectGeneration: string | null;
  pdfSha256: string;
  byteSize: number | null;
  pageCount: number | null;
  contentType: string | null;
};
