import type { HqStock } from './hq-stock.js';
import type { ProductForm } from './product-form.js';
export type ProductDetail = {
  id: string;
  demoId: string;
  form: ProductForm;
  hq: HqStock;
  /** Per-product revision for field edits. */
  revision: number;
  catalogRevision: number;
};
