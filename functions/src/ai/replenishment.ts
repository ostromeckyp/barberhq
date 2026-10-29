import { getDataConnect } from 'firebase-admin/data-connect';
import { getAuth } from 'firebase-admin/auth';
import { getAppCheck } from 'firebase-admin/app-check';
import { onCall } from 'firebase-functions/v2/https';
import { z } from 'genkit';
import type {
  PrepareInput,
  ProposalResult,
  ShorthandLearning,
} from '../../../shared/contracts/ai/index.js';
import { createAiAdmission } from './admission.js';
import { createAiBudget, AiError, runWithinBudget, type AiBudget } from './budget.js';
import {
  aiRuntimeProfileFromEnv,
  createAiAdminDependencies,
  createAiUserEndpoint,
  type ActorContext,
} from './context.js';
import { bindSourceLines } from './proposal.js';
import { createSqlAiRepository } from './repository.js';
import { createReplenishmentRepository } from './replenishment-repository.js';
import { createReplenishmentTools, type ReplenishmentRepository } from './replenishment-tools.js';
import {
  generateReplenishment,
  parseReplenishmentOutput,
  replenishmentReasoningConfig,
  type ReplenishmentGenerator,
} from './replenishment-model.js';
import { createAiRuntime } from './runtime.js';
import {
  createSalonAliasCommands,
  shorthandBounds,
  type ShorthandCommands,
} from './salon-alias-commands.js';
import { parsePrepareInput } from './schemas.js';
import { publicAiError } from './errors.js';
import { stockConnectorConfig } from '../stock/runtime.js';
import { CLOUD } from '../cloud-config.js';

export type ReplenishmentDependencies = {
  resolveActor(uid: string): Promise<ActorContext>;
  admitAiCall(
    actor: ActorContext,
    endpoint: 'replenishment',
    message: string,
    now: Date,
  ): Promise<AiBudget>;
  repository: ReplenishmentRepository;
  generate: ReplenishmentGenerator;
  shorthand: ShorthandCommands;
};
export function createReplenishmentPreparer(dependencies: ReplenishmentDependencies) {
  return async (uid: string, raw: unknown): Promise<ProposalResult> => {
    const began = Date.now();
    const input = parsePrepareInput(raw);
    bindSourceLines(input, []);
    const actor = await dependencies.resolveActor(uid);
    if (actor.role === 'SALON' && !actor.salonIds.includes(input.salonId))
      throw new AiError('FORBIDDEN');
    // Deny a foreign/nonexistent salon before charging the shared AI quota.
    await runWithinBudget(createAiBudget(began), () =>
      dependencies.repository.readContext(actor, input.salonId, createAiBudget(began)),
    );
    const budget = await dependencies.admitAiCall(
      actor,
      'replenishment',
      input.message,
      new Date(),
    );
    const tools = createReplenishmentTools({
      actor,
      input,
      budget,
      repository: dependencies.repository,
    });
    const parsed = parseReplenishmentOutput(
      await runWithinBudget(budget, () => dependencies.generate(budget, input, tools)),
    );
    // Always re-read scope, catalog, active requests and stock after generation.
    const final = await tools.finalProposal(parsed.items);
    const result = final.result;
    // HQ acting for the salon teaches that salon too; SQL rechecks the actor's scope.
    // Learning is auxiliary: its failures never invalidate a verified draft.
    const issuable = final.clarifications.filter((c) => {
      const length = [...c.productQuery.trim()].length;
      return length > 0 && length <= shorthandBounds.phraseChars;
    });
    if (issuable.length) {
      try {
        const receipts = await dependencies.shorthand.issue(
          actor,
          input,
          issuable,
          budget,
          final.catalogRevision,
        );
        result.lines = result.lines.map((l) =>
          l.status === 'NEEDS_CLARIFICATION' && !l.choiceReceiptId && receipts.has(l.lineId)
            ? { ...l, choiceReceiptId: receipts.get(l.lineId)! }
            : l,
        );
      } catch {
        /* Clarifications stay usable; they just cannot teach shorthand. */
      }
    }
    const learning = new Map<string, ShorthandLearning>();
    const receipted = final.choices.flatMap((c) =>
      c.choiceReceiptId ? [{ ...c, choiceReceiptId: c.choiceReceiptId }] : [],
    );
    for (const c of final.choices)
      if (!c.choiceReceiptId)
        learning.set(c.lineId, { lineId: c.lineId, status: 'NOT_SAVED', reason: 'NO_RECEIPT' });
    if (receipted.length) {
      try {
        for (const outcome of await dependencies.shorthand.confirm(actor, input, receipted, budget))
          learning.set(outcome.lineId, outcome);
      } catch {
        for (const c of receipted)
          learning.set(c.lineId, { lineId: c.lineId, status: 'NOT_SAVED', reason: 'UNAVAILABLE' });
      }
    }
    if (learning.size) result.shorthandLearning = final.choices.map((c) => learning.get(c.lineId)!);
    return result;
  };
}

export function createReplenishmentService() {
  const emulator = process.env.FUNCTIONS_EMULATOR === 'true';
  const dc = getDataConnect(
    stockConnectorConfig({
      emulator,
      projectId: process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT,
      emulatorHost: process.env.DATA_CONNECT_EMULATOR_HOST,
      ...(emulator ? {} : { serviceId: CLOUD.sqlService, location: CLOUD.sqlLocation }),
    }),
  );
  const admission = createAiAdmission(createSqlAiRepository(dc));
  const prepare = createReplenishmentPreparer({
    ...admission,
    repository: createReplenishmentRepository(dc),
    generate: generateReplenishment,
    shorthand: createSalonAliasCommands(dc),
  });
  const ai = createAiRuntime(replenishmentReasoningConfig);
  const flow = ai.defineFlow(
    {
      name: 'prepareReplenishmentFlow',
      inputSchema: z.object({ uid: z.string(), input: z.unknown() }),
      outputSchema: z
        .object({ status: z.enum(['PROPOSAL', 'NEEDS_CLARIFICATION', 'UNAVAILABLE']) })
        .passthrough(),
    },
    ({ uid, input }) => prepare(uid, input),
  );
  return (uid: string, input: PrepareInput) => flow({ uid, input });
}
export function createPrepareReplenishmentFunction() {
  return onCall(
    {
      region: 'europe-west1',
      enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true',
      maxInstances: 5,
    },
    async (request) => {
      try {
        const endpoint = createAiUserEndpoint(
          (uid: string, data: PrepareInput) => createReplenishmentService()(uid, data),
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
