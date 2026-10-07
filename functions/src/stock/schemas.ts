import { z } from "zod";
import type { StockAction } from "../../../shared/contracts/stock.js";
import { StockError } from "./errors.js";
const id = z.string().min(1).max(300);
const quantity = z.number().int().min(1).max(99);
const transition = {
  requestId: id,
  expectedRevision: z.number().int().min(1),
  idempotencyKey: z.uuid(),
};
const schemas = {
  SUBMIT: z.strictObject({
    salonId: id,
    productId: id,
    quantity,
    idempotencyKey: z.uuid(),
  }),
  APPROVE: z.strictObject({
    ...transition,
    expectedHqInventoryVersion: z.number().int().min(1),
  }),
  REJECT: z.strictObject({
    ...transition,
    reason: z.string().trim().min(1).max(500),
  }),
  DISPATCH: z.strictObject(transition),
  RECEIVE: z.strictObject({
    ...transition,
    receivedQuantity: quantity,
    allIntact: z.literal(true),
  }),
};
export function parseAction(
  type: StockAction["type"],
  input: unknown,
): StockAction {
  const result = schemas[type].safeParse(input);
  if (!result.success)
    throw new StockError(
      "VALIDATION_ERROR",
      "Check quantities and required fields.",
    );
  return { type, input: result.data } as StockAction;
}
