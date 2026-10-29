import { createHash, randomUUID } from 'node:crypto';
import type { DataConnect } from 'firebase-admin/data-connect';
import { z } from 'genkit';
import type { PrepareInput, ShorthandLearning } from '../../../shared/contracts/ai.js';
import type { SalonShorthand } from '../../../shared/contracts/product-lookup.js';
import { normalizeProduct } from '../../../shared/product-normalization.js';
import { normalizeProductForMatch } from './product-lookup.js';
import type { ActorContext } from './context.js';
import { AiError, consumeToolCall, runWithinBudget, type AiBudget } from './budget.js';

export const shorthandBounds = Object.freeze({ phraseChars: 120, activePerSalon: 200 });
export type IssueChoice = { lineId: string; productQuery: string; allowedProductIds: string[] };
export type ConfirmChoice = { lineId: string; productId: string; choiceReceiptId: string };
export type RemoveShorthandInput = {
  salonId: string;
  aliasId: string;
  expectedRevision: number;
  idempotencyKey: string;
};
export type ShorthandCommands = {
  issue(
    actor: ActorContext,
    input: PrepareInput,
    choices: IssueChoice[],
    budget: AiBudget,
    catalogRevision: number,
  ): Promise<Map<string, string>>;
  confirm(
    actor: ActorContext,
    input: PrepareInput,
    choices: ConfirmChoice[],
    budget: AiBudget,
  ): Promise<ShorthandLearning[]>;
};

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
/**
 * Deterministic per salon phrase as lookup sees it (inflection-folded), so variants share one
 * revisioned row and tombstones keep an increasing revision.
 */
export function salonAliasId(businessId: string, salonId: string, productQuery: string) {
  const key = [businessId, salonId, normalizeProductForMatch(productQuery)].join('\u0000');
  return `salon:${sha256(key).slice(0, 40)}`;
}

const receiptRow = z.object({
  id: z.string(),
  lineId: z.string(),
  messageHash: z.string(),
  productQuery: z.string(),
  aliasId: z.string(),
  allowedProductIds: z.array(z.string()),
  catalogRevision: z.number().int(),
  expectedAliasRevision: z.number().int(),
  live: z.boolean(),
  consumedProductId: z.string().nullable(),
  aliasRevision: z.number().int().nullable(),
  aliasStatus: z.string().nullable(),
  aliasProductId: z.string().nullable(),
  businessRevision: z.number().int(),
  salonRevision: z.number().int(),
  activeCount: z.number().int(),
});
const shorthandSchema = z.object({
  id: z.string(),
  salonId: z.string(),
  salonName: z.string(),
  productId: z.string(),
  productName: z.string(),
  phrase: z.string(),
  revision: z.number().int(),
  status: z.enum(['active', 'retired']),
  updatedAt: z.string(),
});

export function createSalonAliasCommands(dc: DataConnect) {
  async function tool<T>(budget: AiBudget, work: () => Promise<T>): Promise<T> {
    consumeToolCall(budget);
    return runWithinBudget(budget, work);
  }
  return {
    async issue(actor, input, choices, budget, catalogRevision) {
      if (!choices.length) return new Map();
      const messageHash = sha256(input.message);
      const receipts = choices.map((c) => ({
        id: randomUUID(),
        lineId: c.lineId,
        messageHash,
        productQuery: normalizeProduct(c.productQuery),
        aliasId: salonAliasId(actor.businessId, input.salonId, c.productQuery),
        allowedProductIds: c.allowedProductIds,
      }));
      await tool(budget, () =>
        dc.executeMutation('IssueReplenishmentChoiceReceipts', {
          uid: actor.uid,
          businessId: actor.businessId,
          salonId: input.salonId,
          catalogRevision,
          receiptsJson: JSON.stringify(receipts),
        }),
      );
      return new Map(receipts.map((r) => [r.lineId, r.id]));
    },

    async confirm(actor, input, choices, budget) {
      if (!choices.length) return [];
      const outcome = new Map<string, ShorthandLearning>();
      const set = (
        lineId: string,
        status: ShorthandLearning['status'],
        reason?: ShorthandLearning['reason'],
      ) => outcome.set(lineId, { lineId, status, ...(reason ? { reason } : {}) });
      const parsed = z.object({ rows: z.array(receiptRow) }).safeParse(
        (
          await tool(budget, () =>
            dc.executeQuery('ReadSalonShorthandConfirmation', {
              uid: actor.uid,
              businessId: actor.businessId,
              salonId: input.salonId,
              receiptIdsJson: JSON.stringify(choices.map((c) => c.choiceReceiptId)),
            }),
          )
        ).data,
      );
      if (!parsed.success) throw new AiError('SERVICE_UNAVAILABLE');
      const rows = new Map(parsed.data.rows.map((r) => [r.id, r]));
      const messageHash = sha256(input.message);
      const candidates: { choice: ConfirmChoice; row: z.infer<typeof receiptRow> }[] = [];
      for (const choice of choices) {
        const row = rows.get(choice.choiceReceiptId);
        if (
          !row ||
          row.messageHash !== messageHash ||
          row.lineId !== choice.lineId ||
          !row.allowedProductIds.includes(choice.productId)
        )
          set(choice.lineId, 'NOT_SAVED', 'NO_RECEIPT');
        else if (row.consumedProductId)
          row.consumedProductId === choice.productId
            ? set(choice.lineId, 'UNCHANGED')
            : set(choice.lineId, 'NOT_SAVED', 'STALE_STATE');
        else if (!row.live) set(choice.lineId, 'NOT_SAVED', 'EXPIRED');
        else if (
          row.catalogRevision !== row.businessRevision ||
          (row.aliasRevision ?? 0) !== row.expectedAliasRevision
        )
          set(choice.lineId, 'NOT_SAVED', 'STALE_STATE');
        else candidates.push({ choice, row });
      }
      // Opposing explicit products for one phrase stay usable but teach nothing.
      const conflicting = new Set(
        candidates
          .filter((c) =>
            candidates.some(
              (o) => o.row.aliasId === c.row.aliasId && o.choice.productId !== c.choice.productId,
            ),
          )
          .map((c) => c.choice.lineId),
      );
      for (const lineId of conflicting) set(lineId, 'NOT_SAVED', 'CONFLICTING_CHOICES');
      const accepted = candidates.filter((c) => !conflicting.has(c.choice.lineId));
      const writes = new Map<
        string,
        {
          receiptId: string;
          aliasId: string;
          productId: string;
          phrase: string;
          expectedRevision: number;
        }
      >();
      for (const { choice, row } of accepted)
        if (
          !(row.aliasStatus === 'ACTIVE' && row.aliasProductId === choice.productId) &&
          !writes.has(row.aliasId)
        )
          writes.set(row.aliasId, {
            receiptId: row.id,
            aliasId: row.aliasId,
            productId: choice.productId,
            phrase: row.productQuery,
            expectedRevision: row.expectedAliasRevision,
          });
      const inserts = [...writes.values()].filter(
        (w) => accepted.find((a) => a.row.aliasId === w.aliasId)!.row.aliasStatus !== 'ACTIVE',
      ).length;
      const activeCount = accepted[0]?.row.activeCount ?? 0;
      if (accepted.length && activeCount + inserts > shorthandBounds.activePerSalon) {
        for (const { choice } of accepted) set(choice.lineId, 'NOT_SAVED', 'UNAVAILABLE');
      } else if (accepted.length) {
        try {
          await tool(budget, () =>
            dc.executeMutation('ConfirmSalonShorthand', {
              uid: actor.uid,
              businessId: actor.businessId,
              salonId: input.salonId,
              expectedSalonRevision: accepted[0].row.salonRevision,
              writesJson: JSON.stringify([...writes.values()]),
              consumeJson: JSON.stringify(
                accepted.map(({ choice, row }) => ({
                  receiptId: row.id,
                  productId: choice.productId,
                })),
              ),
            }),
          );
          for (const { choice, row } of accepted)
            set(choice.lineId, writes.has(row.aliasId) ? 'LEARNED' : 'UNCHANGED');
        } catch {
          // Never claim learning after an unknown or rejected write.
          for (const { choice } of accepted) set(choice.lineId, 'NOT_SAVED', 'UNAVAILABLE');
        }
      }
      return choices.map((c) => outcome.get(c.lineId)!);
    },

    async remove(uid: string, input: RemoveShorthandInput): Promise<SalonShorthand> {
      const payloadHash = sha256(
        JSON.stringify([input.salonId, input.aliasId, input.expectedRevision]),
      );
      const journal = async () => {
        const data = (
          await dc.executeQuery('ReadSalonAliasOperation', { uid, key: input.idempotencyKey })
        ).data as { salonAliasOperations: { payloadHash: string; result: unknown }[] };
        const op = data.salonAliasOperations[0];
        if (!op) return null;
        if (op.payloadHash !== payloadHash) throw new AiError('VALIDATION_ERROR');
        return shorthandSchema.parse(op.result);
      };
      const replay = await journal();
      if (replay) return replay;
      try {
        await dc.executeMutation('RemoveSalonShorthand', {
          uid,
          salonId: input.salonId,
          aliasId: input.aliasId,
          expectedRevision: input.expectedRevision,
          operationId: randomUUID(),
          key: input.idempotencyKey,
          payloadHash,
        });
      } catch {
        const done = await journal();
        if (done) return done;
        const scope = (
          await dc.executeQuery('ReadSalonShorthandScope', {
            uid,
            salonId: input.salonId,
            aliasId: input.aliasId,
          })
        ).data as {
          membership: {
            businessId: string;
            role: string;
            salonAccesses_on_membership: unknown[];
          } | null;
          productAlias: { businessId: string; salonId: string | null; source: string } | null;
        };
        const m = scope.membership;
        const a = scope.productAlias;
        if (
          !m ||
          !(m.role === 'HQ' || (m.role === 'SALON' && m.salonAccesses_on_membership.length)) ||
          !a ||
          a.businessId !== m.businessId ||
          a.salonId !== input.salonId ||
          a.source !== 'SALON_CONFIRMED'
        )
          throw new AiError('FORBIDDEN');
        throw new AiError('SOURCE_CHANGED');
      }
      const done = await journal();
      if (!done) throw new AiError('SERVICE_UNAVAILABLE');
      return done;
    },
  } satisfies ShorthandCommands & { remove: unknown };
}
export type SalonAliasCommands = ReturnType<typeof createSalonAliasCommands>;
