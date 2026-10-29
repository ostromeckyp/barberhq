import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { DeliveryAction } from '../../../shared/contracts/delivery.js';
import { getStockDataConnect } from '../stock/commands.js';
import { StockError } from '../stock/errors.js';
import { DeliveryRepository } from './repository.js';
import { parseDeliveryAction } from './schemas.js';
import { z } from 'zod';
import { resolveDeliveryProcedures } from './procedures.js';

export function deliveryCommand(type: DeliveryAction['type']) {
  return onCall(
    {
      region: 'europe-west1',
      maxInstances: 5,
      enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true',
    },
    async (request) => {
      if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to continue.');
      try {
        const action = parseDeliveryAction(type, request.data);
        return await new DeliveryRepository(getStockDataConnect()).execute(
          request.auth.uid,
          action,
        );
      } catch (error) {
        if (error instanceof StockError)
          throw new HttpsError(
            error.code === 'FORBIDDEN'
              ? 'permission-denied'
              : error.code === 'VALIDATION_ERROR'
                ? 'invalid-argument'
                : 'failed-precondition',
            error.message,
            { code: error.code, ...(error.conflicts ? { conflicts: error.conflicts } : {}) },
          );
        throw new HttpsError('unavailable', 'Outcome unknown. Retry with the same action key.');
      }
    },
  );
}
export function deliveryProceduresFunction() {
  return onCall(
    {
      region: 'europe-west1',
      maxInstances: 5,
      enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true',
    },
    async (request) => {
      if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to continue.');
      const parsed = z
        .strictObject({
          requestId: z.string().min(1).max(300),
          kinds: z
            .array(z.enum(['DAMAGED', 'MISSING']))
            .min(1)
            .max(2),
        })
        .safeParse(request.data);
      if (!parsed.success)
        throw new HttpsError('invalid-argument', 'Choose a delivery and problem kind.', {
          code: 'VALIDATION_ERROR',
        });
      try {
        return await resolveDeliveryProcedures(
          getStockDataConnect(),
          request.auth.uid,
          parsed.data.requestId,
          parsed.data.kinds,
        );
      } catch (error) {
        if (error instanceof StockError)
          throw new HttpsError(
            'permission-denied',
            'Delivery procedures are unavailable for this scope.',
            { code: error.code },
          );
        throw new HttpsError('unavailable', 'Delivery procedures are temporarily unavailable.');
      }
    },
  );
}
