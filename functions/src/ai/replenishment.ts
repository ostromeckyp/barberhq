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
import { createAiBudget, AiError, runWithinBudget, runWithReservedTime } from './budget.js';
import {
  aiRuntimeProfileFromEnv,
  createAiAdminDependencies,
  createAiUserEndpoint,
} from './context.js';
import { bindSourceLines } from './proposal.js';
import { createSqlAiRepository } from './repository.js';
import { createReplenishmentRepository } from './replenishment-repository.js';
import { createReplenishmentTools } from './replenishment-tools.js';
import {
  generateReplenishment,
  parseReplenishmentOutput,
  replenishmentReasoningConfig,
} from './replenishment-model.js';
import { createAiRuntime } from './runtime.js';
import { createSalonAliasCommands, shorthandBounds } from './salon-alias-commands.js';
import { parsePrepareInput } from './schemas.js';
import { publicAiError } from './errors.js';
import { stockConnectorConfig } from '../stock/runtime.js';
import { CLOUD } from '../cloud-config.js';
import type { ReplenishmentDependencies } from './models/replenishment-dependencies.js';
import type { AiBudget } from './models/ai-budget.js';
import type { AppliedMatch } from './models/applied-match.js';
import type { FinalProposal } from './models/final-proposal.js';
import { createProductMatcher, productMatchingReserveMs } from './product-matching.js';
import { applyMatches } from './product-matching-rules.js';
import { info } from 'firebase-functions/logger';

export function createReplenishmentPreparer(dependencies: ReplenishmentDependencies) {
  /** Auxiliary AI step: any failure or timeout leaves today's deterministic result. */
  async function matchOpenLines(
    budget: AiBudget,
    input: PrepareInput,
    final: FinalProposal,
  ): Promise<AppliedMatch[]> {
    const matcher = dependencies.matchProducts;
    if (!matcher || !final.unresolved.length) return [];
    try {
      const request = {
        language: input.language ?? 'en',
        lines: final.unresolved.map(({ quantity, ...line }) => line),
        catalog: final.catalog,
      };
      const matches = await runWithReservedTime(budget, productMatchingReserveMs, (child) =>
        matcher(child, request),
      );
      return applyMatches(final.unresolved, matches, final.catalog);
    } catch (error) {
      dependencies.log?.('replenishment.matchProducts.failed', {
        code: error instanceof AiError ? error.code : 'UNKNOWN',
      });
      return [];
    }
  }
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
    const deterministic = await tools.finalProposal(parsed.items);
    const applied = await matchOpenLines(budget, input, deterministic);
    // Rebuilt from the same snapshot: no extra read, tool call or stock drift.
    const final = applied.length ? await tools.finalProposal(parsed.items, applied) : deterministic;
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
        result.lines = result.lines.map((l) => {
          const receipt = receipts.get(l.lineId);
          if (!receipt) return l;
          if (l.status === 'NEEDS_CLARIFICATION')
            return l.choiceReceiptId ? l : { ...l, choiceReceiptId: receipt };
          // An AI match teaches nothing itself; its receipt lets a later change teach.
          return l.aiMatch ? { ...l, aiMatch: { ...l.aiMatch, choiceReceiptId: receipt } } : l;
        });
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
    matchProducts: createProductMatcher(),
    log: (event, data) => info(event, data),
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
