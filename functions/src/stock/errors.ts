import type {
  StockErrorCode,
  ActiveConflict,
} from "../../../shared/contracts/stock.js";
export class StockError extends Error {
  constructor(
    readonly code: StockErrorCode,
    message: string = code,
    readonly conflicts?: ActiveConflict[],
  ) {
    super(message);
  }
}
