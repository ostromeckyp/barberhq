import type { DataConnect } from 'firebase-admin/data-connect';
import type {
  DeliveryAction,
  DeliveryCommandResult,
} from '../../../shared/contracts/delivery/index.js';
import { randomUUID, createHash } from 'node:crypto';
import * as sql from '@barberhq/server';
import { StockError } from '../stock/errors.js';
import { canonicalDeliveryPayload } from './intent.js';
import { lookupDeliveryReplay } from './replay.js';

export async function executeSetProcedure(
  dc: DataConnect,
  uid: string,
  action: Extract<DeliveryAction, { type: 'SET_PROCEDURE' }>,
): Promise<DeliveryCommandResult> {
  const input = action.input,
    payloadHash = createHash('sha256').update(canonicalDeliveryPayload(action)).digest('hex');
  const context = async () => {
    const member = (await sql.readDeliveryBindings(dc, { uid })).data.membership;
    if (!member || member.role !== 'HQ') throw new StockError('FORBIDDEN');
    return { member, binding: member.business.bindings.find((row) => row.kind === input.kind) };
  };
  const { member, binding } = await context();
  const replay = () =>
    lookupDeliveryReplay(dc, uid, member.businessId, action, payloadHash, input.kind);
  const existing = await replay();
  if (existing) return existing;
  if ((binding?.revision ?? 0) !== input.expectedRevision) throw new StockError('STALE_STATE');
  if (input.documentId) {
    const document = (
      await sql.readDeliveryProcedureDocument(dc, {
        businessId: member.businessId,
        documentId: input.documentId,
      })
    ).data.knowledgeDocument;
    if (
      !document ||
      !document.versions.some(
        (version) =>
          version.id === document.activeVersionId &&
          version.businessId === member.businessId &&
          version.status === 'READY' &&
          version.publishedAt &&
          !version.revokedAt,
      )
    )
      throw new StockError('SOURCE_CHANGED', 'Choose a current published procedure.');
  }
  const commandId = randomUUID(),
    result: DeliveryCommandResult = {
      commandId,
      bindingRevision: input.expectedRevision + 1,
      replayed: false,
    };
  try {
    await sql.setDeliveryProcedure(dc, {
      uid,
      businessId: member.businessId,
      kind: sql.DeliveryProblemKind[input.kind],
      target: input.kind,
      documentId: input.documentId,
      hasDocument: input.documentId !== null,
      create: !binding,
      revision: input.expectedRevision,
      commandId,
      key: input.idempotencyKey,
      payloadHash,
      result,
    });
  } catch (error) {
    const fresh = await context();
    const committed = await replay();
    if (committed) return committed;
    if ((fresh.binding?.revision ?? 0) !== input.expectedRevision)
      throw new StockError('STALE_STATE');
    const message = error instanceof Error ? error.message : String(error);
    for (const code of ['FORBIDDEN', 'STALE_STATE', 'SOURCE_CHANGED'] as const)
      if (message.includes(code)) throw new StockError(code);
    throw error;
  }
  return result;
}
