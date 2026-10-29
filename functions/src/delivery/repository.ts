import type { DataConnect } from 'firebase-admin/data-connect';
import type {
  DeliveryAction,
  DeliveryCommandResult,
} from '../../../shared/contracts/delivery/index.js';
import { StockError } from '../stock/errors.js';
import { parseDeliveryAction } from './schemas.js';
import { executeIssueAction } from './issue-command.js';
import { executeSetProcedure } from './procedure-command.js';
import { executeReceipt } from './receipt-command.js';

export class DeliveryRepository {
  constructor(private readonly dc: DataConnect) {}
  async execute(uid: string, raw: DeliveryAction): Promise<DeliveryCommandResult> {
    if (!uid) throw new StockError('UNAUTHENTICATED');
    const action = parseDeliveryAction(raw.type, raw.input);
    if (action.type === 'RECORD_RECEIPT') return executeReceipt(this.dc, uid, action);
    if (action.type === 'SET_PROCEDURE') return executeSetProcedure(this.dc, uid, action);
    return executeIssueAction(this.dc, uid, action);
  }
}
