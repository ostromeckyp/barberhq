import type { ProposalResult } from '../../../../shared/contracts/ai';
type RecordValue = Record<string, unknown>;
const record = (x: unknown): x is RecordValue =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const text = (x: unknown): x is string => typeof x === 'string' && x.length > 0 && x.length <= 2000;
const integer = (x: unknown, min = 0) => Number.isSafeInteger(x) && Number(x) >= min;
/** Opaque identifiers: bounded, no whitespace or control characters. */
const identifier = (x: unknown): x is string =>
  typeof x === 'string' && /^[^\s\u0000-\u001f\u007f]{1,200}$/.test(x);
const receipt = (x: unknown) =>
  typeof x === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const learningStatus = ['LEARNED', 'UNCHANGED', 'NOT_SAVED'];
const learningReason = [
  'NO_RECEIPT',
  'STALE_STATE',
  'EXPIRED',
  'UNAVAILABLE',
  'CONFLICTING_CHOICES',
];
function validLearning(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length > 6) return false;
  const ids = new Set<string>();
  return value.every((e) => {
    const ok =
      record(e) &&
      text(e['lineId']) &&
      !ids.has(e['lineId']) &&
      learningStatus.includes(String(e['status'])) &&
      (e['reason'] === undefined || learningReason.includes(String(e['reason'])));
    if (ok) ids.add(e['lineId'] as string);
    return ok;
  });
}
export function isReplenishmentProposal(value: unknown): value is ProposalResult {
  if (
    !record(value) ||
    !['PROPOSAL', 'NEEDS_CLARIFICATION', 'UNAVAILABLE'].includes(String(value['status'])) ||
    !Array.isArray(value['lines']) ||
    value['lines'].length > 6 ||
    !Array.isArray(value['excluded']) ||
    value['excluded'].length > 6 ||
    !Array.isArray(value['toolEvents']) ||
    value['toolEvents'].length > 8
  )
    return false;
  const ids = new Set<string>(),
    products = new Set<string>();
  let unresolved = false;
  for (const line of value['lines']) {
    if (
      !record(line) ||
      !text(line['lineId']) ||
      ids.has(line['lineId']) ||
      line['origin'] !== 'assistant'
    )
      return false;
    ids.add(line['lineId']);
    if (line['status'] === 'READY') {
      if (
        !text(line['productId']) ||
        !text(line['productName']) ||
        products.has(line['productId']) ||
        !integer(line['quantity'], 1) ||
        !integer(line['hqAvailable']) ||
        !integer(line['salonOnHand']) ||
        !integer(line['hqInventoryVersion'], 1) ||
        !integer(line['salonInventoryVersion'], 1)
      )
        return false;
      products.add(line['productId']);
    } else if (line['status'] === 'NEEDS_CLARIFICATION') {
      unresolved = true;
      if (
        !text(line['originalWording']) ||
        !text(line['reason']) ||
        !Array.isArray(line['candidates']) ||
        line['candidates'].length > 200 ||
        !line['candidates'].every(
          (c) => record(c) && identifier(c['productId']) && text(c['productName']),
        ) ||
        new Set(line['candidates'].map((c) => c['productId'])).size !== line['candidates'].length ||
        (line['choiceReceiptId'] !== undefined && !receipt(line['choiceReceiptId'])) ||
        (line['quantity'] !== undefined &&
          (!integer(line['quantity'], 1) || Number(line['quantity']) > 99))
      )
        return false;
    } else return false;
  }
  return (
    validLearning(value['shorthandLearning']) &&
    value['excluded'].every(
      (e) =>
        record(e) &&
        text(e['lineId']) &&
        text(e['productId']) &&
        text(e['requestId']) &&
        e['reason'] === 'ALREADY_ACTIVE',
    ) &&
    value['toolEvents'].every(
      (e) =>
        record(e) &&
        ['findProduct', 'getStockContext', 'calculateProposal'].includes(String(e['name'])) &&
        integer(e['durationMs']),
    ) &&
    (unresolved
      ? value['status'] === 'NEEDS_CLARIFICATION'
      : value['lines'].length
        ? value['status'] === 'PROPOSAL'
        : value['status'] === 'UNAVAILABLE')
  );
}
