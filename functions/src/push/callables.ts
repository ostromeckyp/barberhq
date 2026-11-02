import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as sql from '@barberhq/server';
import { z } from 'zod';
import { getStockDataConnect } from '../stock/commands.js';

const options = {
  region: 'europe-west1',
  enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true',
  maxInstances: 5,
} as const;
const token = z.string().min(1).max(4096);
const registerInput = z.strictObject({ token, locale: z.enum(['en', 'pl']) });
const unregisterInput = z.strictObject({ token });

export function registerPushTokenFunction() {
  return onCall(options, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to continue.');
    const input = registerInput.safeParse(request.data);
    if (!input.success) throw new HttpsError('invalid-argument', 'Invalid input.');
    try {
      await sql.upsertPushToken(getStockDataConnect(), { uid: request.auth.uid, ...input.data });
    } catch (error) {
      if (error instanceof Error && error.message.includes('FORBIDDEN'))
        throw new HttpsError('permission-denied', 'Push is available to salon users only.');
      throw new HttpsError('unavailable', 'Try again.');
    }
    return { ok: true };
  });
}

export function unregisterPushTokenFunction() {
  return onCall(options, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to continue.');
    const input = unregisterInput.safeParse(request.data);
    if (!input.success) throw new HttpsError('invalid-argument', 'Invalid input.');
    try {
      await sql.deletePushToken(getStockDataConnect(), { uid: request.auth.uid, ...input.data });
    } catch {
      throw new HttpsError('unavailable', 'Try again.');
    }
    return { ok: true };
  });
}
