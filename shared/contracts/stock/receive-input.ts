import type { TransitionInput } from './transition-input.js';
export type ReceiveInput = TransitionInput & {
  items: { productId: string; receivedQuantity: number }[];
  allIntact: true;
};
