import type { RequestItemInput } from './request-item-input.js';
export type SubmitInput = {
  salonId: string;
  items: RequestItemInput[];
  idempotencyKey: string;
};
