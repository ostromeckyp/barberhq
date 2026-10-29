import type { LineOrigin } from './line-origin.js';
export type ReadyDraftLine = {
  status: 'READY';
  lineId: string;
  productId: string;
  productName: string;
  quantity: number;
  origin: LineOrigin;
  hqAvailable: number;
  salonOnHand: number;
  hqInventoryVersion: number;
  salonInventoryVersion: number;
};
