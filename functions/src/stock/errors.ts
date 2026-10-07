import type { StockErrorCode } from "../../../shared/contracts/stock.js";
export class StockError extends Error {
  constructor(
    readonly code: StockErrorCode,
    message: string = code,
    readonly requestId?: string,
  ) {
    super(message);
  }
}
