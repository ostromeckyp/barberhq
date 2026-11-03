import type { AiMatch } from './ai-match.js';
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
  /** Present only when the AI chose the product; the UI labels it and offers a change. */
  aiMatch?: AiMatch;
};
