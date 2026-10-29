import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import {
  decodeBackup,
  validateLegacySnapshot,
  type LegacySnapshot,
} from './replenishment-items.ts';
const id = z.string().min(1).max(300);
const journalSchema = z.strictObject({
  userId: id,
  businessId: id,
  salonId: id,
  rows: z
    .array(
      z.strictObject({
        lineId: id,
        status: z.enum(['UNSENT', 'UNKNOWN']),
        payload: z.strictObject({
          salonId: id,
          productId: id,
          quantity: z.number().int().min(1).max(99),
          idempotencyKey: z.uuid(),
        }),
      }),
    )
    .max(6),
});
export type LegacyPendingReport = {
  rows: {
    key: string;
    status: 'COMMITTED' | 'NOT_COMMITTED' | 'UNRESOLVED';
    requestId?: string;
  }[];
};
export function reconcileLegacyPending(
  input: unknown,
  snapshot: LegacySnapshot,
): LegacyPendingReport {
  const journal = journalSchema.parse(input);
  let complete = false;
  try {
    validateLegacySnapshot(snapshot);
    complete = true;
  } catch {
    /* Uncertain evidence cannot authorize deletion/replay. */
  }
  return {
    rows: journal.rows.map((row) => {
      const key = row.payload.idempotencyKey;
      const unresolved = { key, status: 'UNRESOLVED' as const };
      if (
        !complete ||
        journal.businessId !== snapshot.businessId ||
        row.payload.salonId !== journal.salonId
      )
        return unresolved;
      const binding = snapshot.actionKeys.find(
        (k) => k.actorUid === journal.userId && k.idempotencyKey === key,
      );
      if (!binding) return { key, status: 'NOT_COMMITTED' as const };
      const hash = createHash('sha256')
        .update(
          JSON.stringify({
            type: 'SUBMIT',
            salonId: row.payload.salonId,
            productId: row.payload.productId,
            quantity: row.payload.quantity,
          }),
        )
        .digest('hex');
      const receipt = snapshot.receipts.find((r) => r.id === binding.receiptId);
      const request = snapshot.requests.find((r) => r.id === receipt?.requestId);
      return binding.payloadHash === hash &&
        receipt?.action === 'SUBMIT' &&
        request?.salonId === journal.salonId &&
        request.productId === row.payload.productId &&
        request.quantity === row.payload.quantity
        ? { key, status: 'COMMITTED' as const, requestId: request.id }
        : unresolved;
    }),
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values: v } = parseArgs({
    options: {
      journal: { type: 'string' },
      backup: { type: 'string' },
      report: { type: 'string' },
    },
  });
  if (!v.journal || !v.backup || !v.report)
    throw new Error('Require --journal, --backup and --report paths');
  const report = reconcileLegacyPending(
    JSON.parse(readFileSync(v.journal, 'utf8')),
    decodeBackup(JSON.parse(readFileSync(v.backup, 'utf8'))),
  );
  writeFileSync(v.report, JSON.stringify(report, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
  console.log({
    written: true,
    unresolved: report.rows.filter((r) => r.status === 'UNRESOLVED').length,
  });
}
