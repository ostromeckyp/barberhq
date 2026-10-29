import { z } from 'zod';
import type { DeliveryAction } from '../../../shared/contracts/delivery/index.js';
import { StockError } from '../stock/errors.js';

const id = z.string().min(1).max(300);
const quantity = z.number().int().min(0).max(99);
const key = z.uuid();
const kind = z.enum(['DAMAGED', 'MISSING']);
const issueTransition = {
  issueId: id,
  expectedRevision: z.number().int().min(1),
  idempotencyKey: key,
};
const schemas = {
  RECORD_RECEIPT: z
    .strictObject({
      requestId: id,
      expectedRevision: z.number().int().min(1),
      idempotencyKey: key,
      items: z
        .array(
          z.strictObject({
            productId: id,
            goodQuantity: quantity,
            damagedQuantity: quantity,
            missingQuantity: quantity,
          }),
        )
        .min(1)
        .max(6),
      report: z
        .strictObject({
          description: z.string().trim().min(1).max(1000),
          batchIdentifier: z.string().trim().max(120).nullable(),
        })
        .optional(),
      procedureReferences: z
        .array(z.strictObject({ kind, versionId: id, chunkId: id.optional() }))
        .max(2),
    })
    .superRefine((value, ctx) => {
      if (new Set(value.items.map((item) => item.productId)).size !== value.items.length)
        ctx.addIssue({ code: 'custom', message: 'Distinct products required' });
      if (
        value.items.some(
          (item) =>
            item.goodQuantity + item.damagedQuantity + item.missingQuantity < 1 ||
            item.goodQuantity + item.damagedQuantity + item.missingQuantity > 99,
        )
      )
        ctx.addIssue({ code: 'custom', message: 'Classify between 1 and 99 units per product' });
      if (
        value.items.some((item) => item.damagedQuantity + item.missingQuantity > 0) &&
        !value.report
      )
        ctx.addIssue({ code: 'custom', message: 'Describe the delivery problem' });
      if (
        new Set(value.procedureReferences.map((reference) => reference.kind)).size !==
        value.procedureReferences.length
      )
        ctx.addIssue({ code: 'custom', message: 'One reference per problem kind' });
    }),
  START_REVIEW: z.strictObject(issueTransition),
  CREATE_REPLACEMENT: z.strictObject(issueTransition),
  ADD_NOTE: z.strictObject({ ...issueTransition, text: z.string().trim().min(1).max(1000) }),
  SET_PROCEDURE: z.strictObject({
    kind,
    documentId: id.nullable(),
    expectedRevision: z.number().int().min(0),
    idempotencyKey: key,
  }),
};
export function parseDeliveryAction(type: DeliveryAction['type'], input: unknown): DeliveryAction {
  const result = schemas[type].safeParse(input);
  if (!result.success)
    throw new StockError('VALIDATION_ERROR', 'Check quantities and required fields.');
  return { type, input: result.data } as DeliveryAction;
}
