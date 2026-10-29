/** HQ product administration DTOs shared by callables and the HQ product screen. */
/** Catalog categories HQ can assign; the seeded catalog uses exactly these. */
export const productCategories = ['Pomady', 'Lekka Stylizacja', 'Broda zarost i golenie'] as const;
export type ProductCategory = (typeof productCategories)[number];
export type ProductForm = {
  name: string;
  brand: string;
  category: ProductCategory;
  /** Product type used by the assistant's type tier; stored as the seed-level type. */
  type: string | null;
  summary: string;
  scent: string | null;
  netContentMl: number;
  retailPriceGrosz: number;
  sourceCode: string;
  sourceUrl: string;
  observedOn: string;
};
export type HqStock = { onHand: number; reserved: number; available: number; version: number };
export type ProductDetail = {
  id: string;
  demoId: string;
  form: ProductForm;
  hq: HqStock;
  /** Per-product revision for field edits. */
  revision: number;
  catalogRevision: number;
};
export type CreateProductInput = { form: ProductForm; hqOnHand: number; idempotencyKey: string };
export type UpdateProductInput = {
  productId: string;
  expectedRevision: number;
  form: ProductForm;
  idempotencyKey: string;
};
export type SetHqStockInput = {
  productId: string;
  expectedVersion: number;
  onHand: number;
  idempotencyKey: string;
};
export type ProductAliasKind = 'NAME' | 'PHONETIC' | 'TYPE';
export type ProductAliasRow = {
  id: string;
  phrase: string;
  kind: ProductAliasKind;
  source: 'HQ' | 'SEED' | 'DOCUMENT';
  editable: boolean;
  revision: number;
};
export type ProductAliasChange =
  | { op: 'add'; phrase: string; kind: ProductAliasKind }
  | {
      op: 'edit';
      aliasId: string;
      expectedRevision: number;
      phrase: string;
      kind: ProductAliasKind;
    }
  | { op: 'remove'; aliasId: string; expectedRevision: number };
export type SaveProductAliasesInput = {
  productId: string;
  changes: ProductAliasChange[];
  idempotencyKey: string;
};
export type ProductAliasesResult = {
  aliases: ProductAliasRow[];
  collisions: { phrase: string; productNames: string[] }[];
};
