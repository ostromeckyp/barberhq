import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDataConnect } from 'firebase-admin/data-connect';
import type { StockAction } from '../../../shared/contracts/stock.js';
import { StockRepository } from './repository.js';
import { parseAction } from './schemas.js';
import { StockError } from './errors.js';
import { stockConnectorConfig } from './runtime.js';
import { CLOUD } from '../cloud-config.js';

export function getStockDataConnect() {
  const emulator = process.env.FUNCTIONS_EMULATOR === 'true';
  return getDataConnect(
    stockConnectorConfig({
      emulator,
      projectId: process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT,
      emulatorHost: process.env.DATA_CONNECT_EMULATOR_HOST,
      ...(emulator ? {} : { serviceId: CLOUD.sqlService, location: CLOUD.sqlLocation }),
    }),
  );
}

export function stockCommand(type: StockAction['type']) {
  return onCall(
    {
      region: 'europe-west1',
      enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true',
      maxInstances: 5,
    },
    async (request) => {
      if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to continue.');
      try {
        const action = parseAction(type, request.data);
        return await new StockRepository(getStockDataConnect()).execute(request.auth.uid, action);
      } catch (error) {
        if (error instanceof StockError) {
          const code =
            error.code === 'FORBIDDEN'
              ? 'permission-denied'
              : error.code === 'VALIDATION_ERROR'
                ? 'invalid-argument'
                : 'failed-precondition';
          throw new HttpsError(code, error.message, {
            code: error.code,
            ...(error.conflicts ? { conflicts: error.conflicts } : {}),
          });
        }
        // Do not promise failure: SQL may have committed before its response was lost.
        throw new HttpsError('unavailable', 'Outcome unknown. Retry with the same action key.');
      }
    },
  );
}
