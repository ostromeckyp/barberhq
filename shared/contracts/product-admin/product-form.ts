import type { ProductCategory } from './product-category.js';
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
