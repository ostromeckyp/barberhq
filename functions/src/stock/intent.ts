import { createHash } from 'node:crypto';
import type { StockAction } from '../../../shared/contracts/stock/index.js';
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const requestItemId = (requestId: string, productId: string) =>
  `item:${hash([requestId, productId])}`;
export function canonicalizeAction(action: StockAction): StockAction {
  const compare = (a: { productId: string }, b: { productId: string }) =>
    a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0;
  switch (action.type) {
    case 'SUBMIT':
    case 'RECEIVE':
      return {
        ...action,
        input: {
          ...action.input,
          items: [...action.input.items].sort(compare),
        },
      } as StockAction;
    case 'APPROVE':
      return {
        ...action,
        input: {
          ...action.input,
          inventoryVersions: [...action.input.inventoryVersions].sort(compare),
        },
      };
    default:
      return action;
  }
}
export function payloadHash(action: StockAction): string {
  const { idempotencyKey, ...input } = canonicalizeAction(action).input;
  return hash({ type: action.type, ...input });
}
export function semanticHash(action: StockAction): string {
  const { idempotencyKey, expectedRevision, inventoryVersions, ...input } = canonicalizeAction(
    action,
  ).input as StockAction['input'] & {
    expectedRevision?: number;
    inventoryVersions?: unknown;
  };
  return hash({ type: action.type, ...input });
}
