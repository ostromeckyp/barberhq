export type SetHqStockInput = {
  productId: string;
  expectedVersion: number;
  onHand: number;
  idempotencyKey: string;
};
