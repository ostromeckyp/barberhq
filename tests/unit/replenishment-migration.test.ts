import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/replenishment-v1.json' with { type: 'json' };
import {
  convertLegacySnapshot,
  parseLegacySnapshot,
  assertMigrationTarget,
  encodeBackup,
  decodeBackup,
} from '../../scripts/migrations/replenishment-items.ts';
import { reconcileLegacyPending } from '../../scripts/migrations/legacy-pending.ts';
const before = () => structuredClone(fixture);
it('preserves_single_item_history', () => {
  const original = parseLegacySnapshot(before());
  const next = convertLegacySnapshot(original);
  expect(next.requests.map((r) => r.id)).toEqual(['r0', 'r1', 'r2', 'r3', 'r4']);
  expect(next.items).toHaveLength(5);
  expect(next.transferItems).toHaveLength(3);
  expect(next.inventory).toEqual(original.inventory);
  expect(next.actionKeys).toEqual(original.actionKeys);
  expect(next.receipts).toEqual(original.receipts);
  expect(next.movements.map((m) => [m.type, m.quantity, m.actorUid, m.createdAt])).toEqual(
    original.movements.map((m) => [m.type, m.quantity, m.actorUid, m.createdAt]),
  );
  expect(convertLegacySnapshot(original)).toEqual(next);
});
it.each(['duplicate', 'orphan', 'mixed-business', 'wrong-transfer', 'wrong-balance'])(
  'rejects %s data',
  (kind) => {
    const input = before();
    if (kind === 'duplicate') input.requests.push(input.requests[0]);
    if (kind === 'orphan') input.movements[0].transferRequestId = 'missing';
    if (kind === 'mixed-business') input.requests[0].businessId = 'foreign';
    if (kind === 'wrong-transfer') input.transfers[0].quantity = 99;
    if (kind === 'wrong-balance') input.inventory.find((r) => r.reserved === 2)!.reserved = 0;
    expect(() => convertLegacySnapshot(parseLegacySnapshot(input))).toThrow();
  },
);
it('guards_target_and_backup_integrity', () => {
  const target = {
    projectId: 'demo-barberhq',
    businessId: 'not-bad-stuff-demo',
    confirm: 'not-bad-stuff-demo',
    quiescent: true,
  };
  expect(() => assertMigrationTarget(target)).not.toThrow();
  for (const change of [
    { projectId: 'production' },
    { confirm: 'different' },
    { quiescent: false },
  ])
    expect(() => assertMigrationTarget({ ...target, ...change })).toThrow();
  const envelope = encodeBackup(parseLegacySnapshot(before()));
  expect(decodeBackup(envelope)).toEqual(before());
  envelope.snapshot.inventory[0].onHand++;
  expect(() => decodeBackup(envelope)).toThrow(/checksum/i);
});
describe('legacy pending reconciliation', () => {
  const journal = () => ({
    userId: 'salon',
    businessId: fixture.businessId,
    salonId: fixture.requests[0].salonId,
    rows: [
      {
        lineId: 'line',
        status: 'UNKNOWN',
        payload: {
          salonId: fixture.requests[0].salonId,
          productId: fixture.requests[0].productId,
          quantity: 2,
          idempotencyKey: fixture.actionKeys[0].idempotencyKey,
        },
      },
    ],
  });
  it('reconciles_legacy_keys_without_sending', () => {
    const report = reconcileLegacyPending(journal(), parseLegacySnapshot(before()));
    expect(report.rows[0]).toMatchObject({
      status: 'COMMITTED',
      requestId: 'r0',
    });
    const unseen = journal();
    unseen.rows[0].payload.idempotencyKey = '00000000-0000-4000-8000-111111111111';
    expect(reconcileLegacyPending(unseen, parseLegacySnapshot(before())).rows[0].status).toBe(
      'NOT_COMMITTED',
    );
  });
  it('leaves_mismatched_or_incomplete_evidence_unresolved', () => {
    const mismatch = journal();
    mismatch.rows[0].payload.quantity = 3;
    expect(reconcileLegacyPending(mismatch, parseLegacySnapshot(before())).rows[0].status).toBe(
      'UNRESOLVED',
    );
    const incomplete = before();
    incomplete.complete = false;
    expect(reconcileLegacyPending(journal(), parseLegacySnapshot(incomplete)).rows[0].status).toBe(
      'UNRESOLVED',
    );
    expect(() => reconcileLegacyPending({ version: 9 }, parseLegacySnapshot(before()))).toThrow();
  });
});
