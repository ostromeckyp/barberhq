import { getAppCheck } from 'firebase-admin/app-check';
import { getAuth } from 'firebase-admin/auth';
import { getDataConnect } from 'firebase-admin/data-connect';
import { onCall } from 'firebase-functions/v2/https';
import { info } from 'firebase-functions/logger';
import type { TranscribeInput, TranscribeResult } from '../../../shared/contracts/ai/index.js';
import { CLOUD } from '../cloud-config.js';
import { stockConnectorConfig } from '../stock/runtime.js';
import { createAiAdmission } from './admission.js';
import { AiError, createAiBudget, runWithinBudget } from './budget.js';
import {
  aiRuntimeProfileFromEnv,
  createAiAdminDependencies,
  createAiUserEndpoint,
} from './context.js';
import { publicAiError } from './errors.js';
import { createReplenishmentRepository } from './replenishment-repository.js';
import { createSqlAiRepository } from './repository.js';
import { parseTranscribeInput, transcribeAudioMaxBytes } from './schemas.js';
import { bareMimeType, createTranscribeProvider } from './transcription-model.js';
import type { OrderTranscriberDependencies } from './models/order-transcriber-dependencies.js';

const maxTranscriptChars = 2000;

export function createOrderTranscriber(dependencies: OrderTranscriberDependencies) {
  return async (uid: string, raw: unknown): Promise<TranscribeResult> => {
    const began = Date.now();
    const input = parseTranscribeInput(raw);
    const actor = await dependencies.resolveActor(uid);
    if (actor.role === 'SALON' && !actor.salonIds.includes(input.salonId))
      throw new AiError('FORBIDDEN');
    // Deny a foreign/nonexistent salon before charging the shared AI quota.
    await dependencies.assertSalon(actor, input.salonId);
    const audio = Buffer.from(input.audio, 'base64');
    if (audio.length === 0 || audio.length > transcribeAudioMaxBytes)
      throw new AiError('VALIDATION_ERROR');
    const budget = await dependencies.admitAiCall(
      actor,
      'transcription',
      `audio ${bareMimeType(input.mimeType)} ${audio.length}B`,
      new Date(),
    );
    const text = (
      await runWithinBudget(budget, () =>
        dependencies.transcribe(budget, {
          audio,
          mimeType: input.mimeType,
          language: input.language,
        }),
      )
    ).trim();
    dependencies.log?.('transcription', {
      bytes: audio.length,
      language: input.language,
      chars: text.length,
      ms: Date.now() - began,
    });
    if (!text) throw new AiError('NO_SPEECH');
    return { text: [...text].slice(0, maxTranscriptChars).join('') };
  };
}

function createTranscribeService() {
  const emulator = process.env.FUNCTIONS_EMULATOR === 'true';
  const dc = getDataConnect(
    stockConnectorConfig({
      emulator,
      projectId: process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT,
      emulatorHost: process.env.DATA_CONNECT_EMULATOR_HOST,
      ...(emulator ? {} : { serviceId: CLOUD.sqlService, location: CLOUD.sqlLocation }),
    }),
  );
  const repository = createReplenishmentRepository(dc);
  return createOrderTranscriber({
    ...createAiAdmission(createSqlAiRepository(dc)),
    assertSalon: async (actor, salonId) => {
      const began = Date.now();
      await runWithinBudget(createAiBudget(began), () =>
        repository.readContext(actor, salonId, createAiBudget(began)),
      );
    },
    transcribe: createTranscribeProvider(),
    log: (event, data) => info(event, data),
  });
}

export function createTranscribeOrderFunction() {
  return onCall(
    {
      region: 'europe-west1',
      enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true',
      maxInstances: 5,
    },
    async (request) => {
      try {
        const endpoint = createAiUserEndpoint(
          (uid: string, data: TranscribeInput) => createTranscribeService()(uid, data),
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
