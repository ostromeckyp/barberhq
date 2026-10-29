import type { ProductForm } from './product-form.js';
export type CreateProductInput = { form: ProductForm; hqOnHand: number; idempotencyKey: string };
