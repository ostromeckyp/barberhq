import type { DataConnect } from 'firebase-admin/data-connect';
import type {
  DeliveryAction,
  DeliveryCommandResult,
} from '../../../shared/contracts/delivery/index.js';
import * as sql from '@barberhq/server';
import { StockError } from '../stock/errors.js';

export async function lookupDeliveryReplay(
  dc: DataConnect,
  uid: string,
  businessId: string,
  action: DeliveryAction,
  payloadHash: string,
  target: string,
): Promise<DeliveryCommandResult | undefined> {
  const key = (await sql.readDeliveryKey(dc, { uid, businessId, key: action.input.idempotencyKey }))
    .data.deliveryActionKey;
  if (!key) return;
  if (
    key.payloadHash !== payloadHash ||
    key.command.businessId !== businessId ||
    key.command.actorUid !== uid ||
    key.command.type !== action.type ||
    key.command.target !== target
  )
    throw new StockError('IDEMPOTENCY_CONFLICT');
  return { ...(key.command.result as DeliveryCommandResult), replayed: true };
}
