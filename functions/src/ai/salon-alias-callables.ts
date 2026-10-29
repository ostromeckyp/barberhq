import { getAuth } from 'firebase-admin/auth';
import { getAppCheck } from 'firebase-admin/app-check';
import { getDataConnect } from 'firebase-admin/data-connect';
import { onCall } from 'firebase-functions/v2/https';
import { z } from 'genkit';
import { AiError } from './budget.js';
import {
  aiRuntimeProfileFromEnv,
  createAiAdminDependencies,
  createAiUserEndpoint,
} from './context.js';
import { publicAiError } from './errors.js';
import { createSalonAliasCommands, type RemoveShorthandInput } from './salon-alias-commands.js';
import { stockConnectorConfig } from '../stock/runtime.js';
import { CLOUD } from '../cloud-config.js';

const identifier = z.string().min(1).max(200);
const removeInput = z
  .object({
    salonId: identifier,
    aliasId: identifier,
    expectedRevision: z.number().int().min(1).max(2147483646),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
export function parseRemoveShorthandInput(input: unknown): RemoveShorthandInput {
  const parsed = removeInput.safeParse(input);
  if (!parsed.success) throw new AiError('VALIDATION_ERROR');
  return parsed.data;
}

/** Only the salon's own staff remove its shorthand; HQ and forged writes are rejected by SQL scope. */
export function createRemoveSalonShorthandFunction() {
  return onCall(
    {
      region: 'europe-west1',
      enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true',
      maxInstances: 5,
    },
    async (request) => {
      try {
        const emulator = process.env.FUNCTIONS_EMULATOR === 'true';
        const dc = getDataConnect(
          stockConnectorConfig({
            emulator,
            projectId: process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT,
            emulatorHost: process.env.DATA_CONNECT_EMULATOR_HOST,
            ...(emulator ? {} : { serviceId: CLOUD.sqlService, location: CLOUD.sqlLocation }),
          }),
        );
        const endpoint = createAiUserEndpoint(
          (uid: string, data: unknown) =>
            createSalonAliasCommands(dc).remove(uid, parseRemoveShorthandInput(data)),
          createAiAdminDependencies(getAuth(), getAppCheck()),
          aiRuntimeProfileFromEnv(),
        );
        const header = (name: string) => {
          const v = request.rawRequest.headers[name];
          return typeof v === 'string' ? v : undefined;
        };
        const bearer = header('authorization');
        return await endpoint({
          authUid: request.auth?.uid,
          idToken: bearer?.startsWith('Bearer ') ? bearer.slice(7) : undefined,
          appCheckToken: header('x-firebase-appcheck'),
          data: request.data,
        });
      } catch (error) {
        return publicAiError(error);
      }
    },
  );
}
