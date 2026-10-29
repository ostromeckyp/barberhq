import { expect, it } from 'vitest';
import {
  backfillKnowledgeMetadata,
  type MetadataRepository,
} from '../../scripts/ingest/backfill-knowledge-metadata.js';

function fixture(count = 1) {
  const rows = Array.from({ length: count }, (_, i) => ({
    id: `v${String(i).padStart(4, '0')}`,
    businessId: 'business',
    sourceType: 'SYNTHETIC_PROCEDURE',
    synthetic: true,
    kind: null as string | null,
    origin: null as string | null,
    status: i % 2 ? 'READY' : 'FAILED',
    revokedAt: i % 2 ? '2026-01-01' : null,
    pdfSha256: 'a'.repeat(64),
    revision: 9,
  }));
  let race = false;
  const repo: MetadataRepository = {
    page: async (after, limit) => rows.filter((r) => r.id > after).slice(0, limit),
    compareAndSet: async (row, target) => {
      if (race) return false;
      Object.assign(
        rows.find((r) => r.id === row.id)!,
        { kind: target.kind, origin: target.origin },
      );
      return true;
    },
  };
  return {
    rows,
    repo,
    race: () => {
      race = true;
    },
  };
}
it('dry-runs all pages without changes, applies only classification and repeats idempotently', async () => {
  const h = fixture(205),
    before = structuredClone(h.rows);
  expect(
    await backfillKnowledgeMetadata(h.repo, { businessId: 'business', apply: false }),
  ).toMatchObject({ scanned: 205, changed: 0, planned: 205, conflicts: 0 });
  expect(h.rows).toEqual(before);
  const result = await backfillKnowledgeMetadata(h.repo, { businessId: 'business', apply: true });
  expect(result).toMatchObject({ scanned: 205, changed: 205, conflicts: 0, preserved: true });
  expect(h.rows.map(({ kind, origin, ...r }) => r)).toEqual(
    before.map(({ kind, origin, ...r }) => r),
  );
  expect(
    await backfillKnowledgeMetadata(h.repo, { businessId: 'business', apply: true }),
  ).toMatchObject({ changed: 0, alreadyCorrect: 205 });
});
it('validates every row before writing and returns precise conflicts without guessing', async () => {
  for (const invalid of [
    { kind: 'POLICY' },
    { synthetic: false },
    { sourceType: 'UNKNOWN' },
    { businessId: 'foreign' },
  ]) {
    const h = fixture(2);
    Object.assign(h.rows[1], invalid);
    expect(
      await backfillKnowledgeMetadata(h.repo, { businessId: 'business', apply: true }),
    ).toMatchObject({ changed: 0, conflicts: 1, preserved: true });
    expect(h.rows[0].kind).toBeNull();
  }
});
it('stops on a concurrent CAS edit and reports the resumable row', async () => {
  const h = fixture(2);
  h.race();
  const result = await backfillKnowledgeMetadata(h.repo, { businessId: 'business', apply: true });
  expect(result).toMatchObject({ changed: 0, conflicts: 1 });
  expect(result.rows.find((r) => r.conflict)?.id).toBe('v0000');
});
