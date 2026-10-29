import { readFileSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  initialize: vi.fn(() => ({})),
  connect: vi.fn(() => ({})),
  counts: vi.fn(),
  apply: vi.fn(),
  bucket: vi.fn(() => ({ name: 'bucket' })),
  rebuild: vi.fn(async () => ({ planned: ['DAM-001 v1'] })),
}));
vi.mock('firebase-admin/storage', () => ({ getStorage: () => ({ bucket: mocks.bucket }) }));
vi.mock('../../functions/src/knowledge/embedding.ts', () => ({
  createEmbeddingConfig: vi.fn(() => ({})),
  createVertexEmbeddingAdapter: vi.fn(() => ({ embedder: true })),
}));
vi.mock('../../scripts/seed/knowledge.ts', () => ({ rebuildKnowledge: mocks.rebuild }));
vi.mock('firebase-admin/app', () => ({
  initializeApp: mocks.initialize,
  applicationDefault: vi.fn(),
  deleteApp: vi.fn(),
}));
vi.mock('firebase-admin/data-connect', () => ({ getDataConnect: mocks.connect }));
vi.mock('@barberhq/server', () => ({
  connectorConfig: { connector: 'server', serviceId: 'barberhq', location: 'europe-west1' },
  readResetCounts: mocks.counts,
  resetDemoStock: mocks.apply,
}));
import { resetDemo, safeResetError } from '../../scripts/seed/reset.ts';
const publicConfig = JSON.parse(readFileSync('config/public.example.json', 'utf8'));
const input = {
  projectId: 'notbad-6be95',
  businessKey: 'not-bad-stuff-demo',
  confirmBusinessKey: 'not-bad-stuff-demo',
  quiescent: true,
  dryRun: true,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('DATA_CONNECT_EMULATOR_HOST', '');
  vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '');
  mocks.counts.mockResolvedValue({
    data: Object.fromEntries(
      [
        'requests',
        'active',
        'transfers',
        'items',
        'transferItems',
        'movements',
        'receipts',
        'keys',
        'inventories',
        'deliveryReceipts',
        'deliveryItems',
        'deliveryIssues',
        'deliveryIssueItems',
        'deliveryEvents',
        'deliveryReferences',
        'deliveryKeys',
        'deliveryCommands',
      ].map((key) => [key, [{ _count: 1 }]]),
    ),
  });
});
it('cloud dry-run uses the approved deployed target despite a stale generated SDK and never applies', async () => {
  expect(await resetDemo({ ...input, publicConfig })).toEqual({
    knowledge: { planned: ['DAM-001 v1'] },
    deletedOperationalRows: 16,
    resetInventoryRows: 1,
  });
  expect(mocks.bucket).toHaveBeenCalledWith('notbad-6be95.firebasestorage.app');
  expect(mocks.rebuild).toHaveBeenCalledWith(
    expect.objectContaining({ businessId: 'not-bad-stuff-demo', embedder: { embedder: true } }),
    true,
  );
  expect(mocks.connect).toHaveBeenCalledWith(
    { connector: 'vector', serviceId: 'notbad-6be95-service', location: 'europe-west3' },
    expect.anything(),
  );
  expect(mocks.connect).toHaveBeenCalledWith(
    { connector: 'server', serviceId: 'notbad-6be95-service', location: 'europe-west3' },
    expect.anything(),
  );
  expect(mocks.apply).not.toHaveBeenCalled();
});
it('cloud reset refuses a missing or foreign public target before creating an Admin app', async () => {
  for (const config of [
    undefined,
    { ...publicConfig, dataConnect: { ...publicConfig.dataConnect, serviceId: 'other-service' } },
    { ...publicConfig, dataConnect: { ...publicConfig.dataConnect, location: 'europe-west1' } },
  ])
    await expect(resetDemo({ ...input, publicConfig: config })).rejects.toThrow();
  expect(mocks.initialize).not.toHaveBeenCalled();
  expect(mocks.apply).not.toHaveBeenCalled();
});
it('cloud reset refuses emulator configuration before creating an Admin app', async () => {
  vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099');
  await expect(resetDemo({ ...input, publicConfig })).rejects.toThrow();
  expect(mocks.initialize).not.toHaveBeenCalled();
});
it('CLI errors expose only controlled codes, never raw SDK request headers', () => {
  const error = Object.assign(new Error('request failed'), {
    cause: { headers: { Authorization: 'test-sensitive-value' } },
  });
  expect(safeResetError(error)).toBe('RESET_OPERATION_FAILED');
  expect(safeResetError(new Error('RESET_TARGET_INVALID'))).toBe('RESET_TARGET_INVALID');
  expect(safeResetError(new Error('KNOWLEDGE_SEED_INVALID: REP-001 v1: RECEIPT_MISSING'))).toBe(
    'KNOWLEDGE_SEED_INVALID: REP-001 v1: RECEIPT_MISSING',
  );
  expect(safeResetError(new Error('KNOWLEDGE_EXTRACTION_CHANGED: CARD-NBS-SOL-200 v1'))).toBe(
    'KNOWLEDGE_EXTRACTION_CHANGED: CARD-NBS-SOL-200 v1',
  );
  expect(safeResetError(new Error('KNOWLEDGE_X: https://secret.example/?token=1'))).toBe(
    'RESET_OPERATION_FAILED',
  );
});
