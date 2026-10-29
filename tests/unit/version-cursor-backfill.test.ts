import { expect, it } from 'vitest';
import {
  backfillVersionCursors,
  type CursorRepository,
} from '../../scripts/ingest/backfill-version-cursors.ts';

function fixture(labels: Record<string, string[]>, cursors: Record<string, number | null> = {}) {
  const docs = Object.keys(labels)
    .sort()
    .map((id) => ({ id, businessId: 'demo-business', nextVersionNumber: cursors[id] ?? null }));
  const writes: { id: string; expected: number | null; target: number }[] = [];
  const repo: CursorRepository = {
    listDocuments: async (after, limit) => docs.filter((d) => d.id > after).slice(0, limit),
    listLabels: async (id, after, limit) =>
      [...labels[id]]
        .sort()
        .filter((v) => v > after)
        .slice(0, limit),
    getDocument: async (id) => docs.find((d) => d.id === id) ?? null,
    compareAndSet: async (id, expected, target) => {
      writes.push({ id, expected, target });
      const doc = docs.find((d) => d.id === id)!;
      if (doc.nextVersionNumber !== expected) return false;
      doc.nextVersionNumber = target;
      return true;
    },
  };
  return { repo, writes, docs };
}
it('dry-runs all 101 labels and computes max plus one without writing', async () => {
  const f = fixture({ d1: [...Array.from({ length: 100 }, (_, i) => `v${i + 1}`), 'v999'] });
  const result = await backfillVersionCursors(f.repo, 'demo-business', false, 17);
  expect(result.changes).toEqual([{ documentId: 'd1', from: null, to: 1000 }]);
  expect(f.writes).toEqual([]);
});
it('initializes v0/v1 to 2 and empty history to 1', async () => {
  const f = fixture({ d1: ['v0', 'v1'], d2: [] });
  await backfillVersionCursors(f.repo, 'demo-business', true, 1);
  expect(f.writes).toEqual([
    { id: 'd1', expected: null, target: 2 },
    { id: 'd2', expected: null, target: 1 },
  ]);
});
it('never lowers an existing higher cursor and a CAS race cannot lower it', async () => {
  const f = fixture({ d1: ['v1'] }, { d1: 8 });
  expect((await backfillVersionCursors(f.repo, 'demo-business', true, 1)).changes).toEqual([]);
  const raced = fixture({ d1: ['v4'] }, { d1: 2 });
  raced.repo.compareAndSet = async () => {
    raced.docs[0].nextVersionNumber = 10;
    return false;
  };
  await backfillVersionCursors(raced.repo, 'demo-business', true, 1);
  expect(raced.docs[0].nextVersionNumber).toBe(10);
});
it.each(['v01', 'v-1', 'V2', 'v2147483647'])(
  'refuses malformed or out-of-range label %s',
  async (label) => {
    await expect(
      backfillVersionCursors(fixture({ d1: [label] }).repo, 'demo-business', false, 1),
    ).rejects.toThrow();
  },
);
it('validates every document before applying any cursor update', async () => {
  const f = fixture({ d1: ['v1'], d2: ['v01'] });
  await expect(backfillVersionCursors(f.repo, 'demo-business', true, 1)).rejects.toThrow();
  expect(f.writes).toEqual([]);
});
