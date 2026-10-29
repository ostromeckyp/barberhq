import type { TransitionInput } from './transition-input.js';
export type ApproveInput = TransitionInput & {
  inventoryVersions: {
    productId: string;
    expectedHqInventoryVersion: number;
  }[];
};
