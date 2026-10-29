import type { ProductForm } from './product-form.js';
export type UpdateProductInput = {
  productId: string;
  expectedRevision: number;
  form: ProductForm;
  idempotencyKey: string;
};
