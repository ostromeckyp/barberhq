import { expect, it } from 'vitest';
import { parseDeliveryAction } from '../../functions/src/delivery/schemas.ts';
import {
  canonicalDeliveryPayload,
  deliveryIssueId,
  deliveryReceiptId,
} from '../../functions/src/delivery/intent.ts';

const input = {
  requestId: 'request',
  expectedRevision: 3,
  idempotencyKey: '00000000-0000-4000-8000-000000000001',
  items: [
    { productId: 'b', goodQuantity: 8, damagedQuantity: 2, missingQuantity: 0 },
    { productId: 'a', goodQuantity: 0, damagedQuantity: 0, missingQuantity: 3 },
  ],
  report: { description: '  Broken seal  ', batchIdentifier: null },
  procedureReferences: [
    { kind: 'MISSING' as const, versionId: 'v2' },
    { kind: 'DAMAGED' as const, versionId: 'v1', chunkId: 'c1' },
  ],
};
it('accepts_zero_good_units_and_trims_report_without_inventing_batch', () => {
  const action = parseDeliveryAction('RECORD_RECEIPT', input);
  expect(action.input).toMatchObject({
    items: input.items,
    report: { description: 'Broken seal', batchIdentifier: null },
  });
});
it('accepts_six_products_but_rejects_seven_or_duplicates', () => {
  const six = Array.from({ length: 6 }, (_, i) => ({
    productId: `p${i}`,
    goodQuantity: i + 1,
    damagedQuantity: 0,
    missingQuantity: 0,
  }));
  expect(() => parseDeliveryAction('RECORD_RECEIPT', { ...input, items: six })).not.toThrow();
  expect(() =>
    parseDeliveryAction('RECORD_RECEIPT', { ...input, items: [...six, six[0]] }),
  ).toThrow();
  expect(() =>
    parseDeliveryAction('RECORD_RECEIPT', { ...input, items: [six[0], six[0]] }),
  ).toThrow();
});
it.each([-1, 0.5, 100, NaN, Infinity])('rejects_invalid_quantity_%s', (goodQuantity) => {
  expect(() =>
    parseDeliveryAction('RECORD_RECEIPT', {
      ...input,
      items: [{ ...input.items[0], goodQuantity }],
    }),
  ).toThrow();
});
it('rejects_unclassified_empty_rows_and_total_over_99', () => {
  for (const quantities of [
    { goodQuantity: 0, damagedQuantity: 0, missingQuantity: 0 },
    { goodQuantity: 99, damagedQuantity: 1, missingQuantity: 0 },
  ])
    expect(() =>
      parseDeliveryAction('RECORD_RECEIPT', {
        ...input,
        items: [{ productId: 'p', ...quantities }],
      }),
    ).toThrow();
});
it('requires_report_for_a_problem_but_not_for_all_good', () => {
  expect(() => parseDeliveryAction('RECORD_RECEIPT', { ...input, report: undefined })).toThrow();
  expect(() =>
    parseDeliveryAction('RECORD_RECEIPT', {
      ...input,
      report: undefined,
      items: [{ productId: 'a', goodQuantity: 10, damagedQuantity: 0, missingQuantity: 0 }],
    }),
  ).not.toThrow();
});
it.each([
  { ...input, report: { description: ' ', batchIdentifier: null } },
  { ...input, report: { description: 'x'.repeat(1001), batchIdentifier: null } },
  { ...input, report: { description: 'ok', batchIdentifier: 'x'.repeat(121) } },
  { ...input, salonId: 'foreign' },
  { ...input, items: [{ ...input.items[0], unexpected: true }] },
  { ...input, procedureReferences: [{ kind: 'RETURN', versionId: 'v' }] },
  { ...input, procedureReferences: [input.procedureReferences[0], input.procedureReferences[0]] },
])('rejects_malformed_report_reference_or_unknown_fields %#', (invalid) => {
  expect(() => parseDeliveryAction('RECORD_RECEIPT', invalid)).toThrow();
});
it('canonical_payload_sorts_products_references_and_omits_only_key', () => {
  const original = parseDeliveryAction('RECORD_RECEIPT', input);
  const reordered = parseDeliveryAction('RECORD_RECEIPT', {
    ...input,
    idempotencyKey: '00000000-0000-4000-8000-000000000002',
    items: [...input.items].reverse(),
    procedureReferences: [...input.procedureReferences].reverse(),
  });
  expect(canonicalDeliveryPayload(original)).toBe(canonicalDeliveryPayload(reordered));
  const reclassified = parseDeliveryAction('RECORD_RECEIPT', {
    ...input,
    items: [{ ...input.items[0], goodQuantity: 7, damagedQuantity: 3 }, input.items[1]],
  });
  expect(canonicalDeliveryPayload(original)).not.toBe(canonicalDeliveryPayload(reclassified));
  expect(canonicalDeliveryPayload(original)).not.toContain(input.idempotencyKey);
  expect(canonicalDeliveryPayload(original)).not.toBe(
    canonicalDeliveryPayload(
      parseDeliveryAction('RECORD_RECEIPT', { ...input, expectedRevision: 4 }),
    ),
  );
});
it('validates_notes_transitions_and_binding_revision_without_reset_on_disable', () => {
  const transition = {
    issueId: 'issue',
    expectedRevision: 1,
    idempotencyKey: input.idempotencyKey,
  };
  expect(
    parseDeliveryAction('ADD_NOTE', { ...transition, text: '  Contacted HQ  ' }).input,
  ).toMatchObject({ text: 'Contacted HQ' });
  expect(() => parseDeliveryAction('ADD_NOTE', { ...transition, text: ' ' })).toThrow();
  expect(() =>
    parseDeliveryAction('START_REVIEW', { ...transition, expectedRevision: 0 }),
  ).toThrow();
  expect(() =>
    parseDeliveryAction('CREATE_REPLACEMENT', { ...transition, quantity: 10 }),
  ).toThrow();
  expect(
    parseDeliveryAction('SET_PROCEDURE', {
      kind: 'DAMAGED',
      documentId: null,
      expectedRevision: 3,
      idempotencyKey: input.idempotencyKey,
    }).input,
  ).toMatchObject({ documentId: null, expectedRevision: 3 });
  expect(() =>
    parseDeliveryAction('SET_PROCEDURE', {
      kind: 'DAMAGED',
      documentId: null,
      expectedRevision: -1,
      idempotencyKey: input.idempotencyKey,
    }),
  ).toThrow();
});
it('receipt_and_issue_ids_are_stable_and_disjoint', () => {
  expect(deliveryReceiptId('request-a')).toBe(deliveryReceiptId('request-a'));
  expect(deliveryReceiptId('request-a')).not.toBe(deliveryReceiptId('request-b'));
  expect(deliveryIssueId('request-a')).not.toBe(deliveryReceiptId('request-a'));
});
