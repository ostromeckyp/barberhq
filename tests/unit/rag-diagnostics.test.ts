import { describe, expect, it } from 'vitest';
import { AiError, createAiBudget } from '../../functions/src/ai/budget.ts';
import { createProcedureAnswerer } from '../../functions/src/ai/procedure.ts';
import type { RetrievedChunk } from '../../functions/src/ai/retrieval.ts';

const actor = {
  uid: 'private-user',
  businessId: 'private-business',
  role: 'HQ' as const,
  salonIds: [],
};
const input = { question: 'private question about dye', answerLanguage: 'en' as const };
const chunk = {
  businessId: actor.businessId,
  documentId: 'private-document',
  versionId: 'private-version',
  version: 'v1',
  title: 'private title',
  language: 'en',
  synthetic: true,
  kind: 'procedure',
  origin: 'synthetic',
  superseded: false,
  pageCount: 1,
  chunkId: 'private-chunk',
  sourceSectionId: 'private-chunk',
  sectionId: 'private-section',
  physicalPage: 1,
  excerpt: 'private excerpt',
  geometry: { viewBox: [0, 0, 100, 100], userUnit: 1, rotation: 0 },
  rects: [],
  geometryStatus: 'UNAVAILABLE',
  cosineDistance: 0.1,
  documentRevision: 1,
  embeddingConfigHash: 'a'.repeat(64),
} as RetrievedChunk;
const answer = JSON.stringify({
  status: 'ANSWER',
  steps: [{ text: 'Follow the cited step.', sourceSectionIds: [chunk.chunkId] }],
  missingInformation: [],
});

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    resolveActor: async () => actor,
    admitAiCall: async () => createAiBudget(Date.now()),
    retrieve: async () => [chunk],
    generate: async () => answer,
    recheck: async () => true,
    ...overrides,
  };
}

describe('procedure phase diagnostics', () => {
  it('reports each completed stage without request or source data and preserves the answer', async () => {
    const events: Record<string, unknown>[] = [];
    const result = await createProcedureAnswerer(dependencies(), (event) => events.push(event))(
      'private-user',
      input,
    );
    expect(result.status).toBe('ANSWER');
    expect(events.map(({ stage, state, attempt }) => [stage, state, attempt])).toEqual([
      ['actor', 'start', 1],
      ['actor', 'success', 1],
      ['admission', 'start', 1],
      ['admission', 'success', 1],
      ['retrieval', 'start', 1],
      ['retrieval', 'success', 1],
      ['generation', 'start', 1],
      ['generation', 'success', 1],
      ['recheck', 'start', 1],
      ['recheck', 'success', 1],
    ]);
    expect(
      events.every((event) => typeof event.elapsedMs === 'number' && event.elapsedMs >= 0),
    ).toBe(true);
    expect(
      events.every((event) =>
        Object.keys(event).every((key) =>
          ['stage', 'state', 'attempt', 'elapsedMs', 'code'].includes(key),
        ),
      ),
    ).toBe(true);
    expect(JSON.stringify(events)).not.toMatch(/private|prompt|excerpt|uid|business|vector|token/i);
  });

  it('labels a targeted retry as attempt two and preserves the recovered answer', async () => {
    const events: Record<string, unknown>[] = [];
    let generations = 0;
    const result = await createProcedureAnswerer(
      dependencies({
        generate: async () =>
          ++generations === 1
            ? JSON.stringify({ status: 'MISSING_CONTEXT', searchQuery: 'private targeted query' })
            : answer,
      }),
      (event) => events.push(event),
    )('private-user', input);
    expect(result.status).toBe('ANSWER');
    expect(
      events.filter((e) => e.stage === 'retrieval' && e.state === 'start').map((e) => e.attempt),
    ).toEqual([1, 2]);
    expect(
      events.filter((e) => e.stage === 'generation' && e.state === 'success').map((e) => e.attempt),
    ).toEqual([1, 2]);
    expect(
      events.filter((e) => e.stage === 'recheck' && e.state === 'start').map((e) => e.attempt),
    ).toEqual([2]);
    expect(JSON.stringify(events)).not.toContain('private');
  });

  it('records TIMEOUT when a budgeted stage rejects before its underlying work settles', async () => {
    const events: Record<string, unknown>[] = [];
    let release!: () => void;
    const pending = new Promise<RetrievedChunk[]>((resolve) => {
      release = () => resolve([chunk]);
    });
    const run = createProcedureAnswerer(
      dependencies({
        admitAiCall: async () => createAiBudget(Date.now() - 24_975),
        retrieve: async () => pending,
      }),
      (event) => events.push(event),
    )('private-user', input);
    await expect(run).rejects.toMatchObject({ code: 'TIMEOUT' });
    expect(events.filter((e) => e.stage === 'retrieval').map((e) => [e.state, e.code])).toEqual([
      ['start', undefined],
      ['error', 'TIMEOUT'],
    ]);
    release();
    await Promise.resolve();
    expect(events.filter((e) => e.stage === 'retrieval')).toHaveLength(2);
  });

  it('reports only UNKNOWN for arbitrary exceptions and observer failures do not alter results', async () => {
    const events: Record<string, unknown>[] = [];
    const failingObserver = (event: Record<string, unknown>) => {
      events.push(event);
      throw new Error('observer failed');
    };
    const success = await createProcedureAnswerer(dependencies(), failingObserver)(
      'private-user',
      input,
    );
    expect(success.status).toBe('ANSWER');
    await expect(
      createProcedureAnswerer(
        dependencies({
          generate: async () => {
            throw new Error('private provider detail');
          },
        }),
        failingObserver,
      )('private-user', input),
    ).rejects.toThrow('private provider detail');
    expect(events.filter((e) => e.stage === 'generation' && e.state === 'error').at(-1)?.code).toBe(
      'UNKNOWN',
    );
    await expect(
      createProcedureAnswerer(
        dependencies({
          retrieve: async () => {
            throw new AiError('FORBIDDEN');
          },
        }),
        failingObserver,
      )('private-user', input),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(events.filter((e) => e.stage === 'retrieval' && e.state === 'error').at(-1)?.code).toBe(
      'FORBIDDEN',
    );
    expect(JSON.stringify(events)).not.toContain('private');
  });

  it('classifies a fabricated citation as a generation error', async () => {
    const events: Record<string, unknown>[] = [];
    const bad = JSON.stringify({
      status: 'ANSWER',
      steps: [{ text: 'Unfounded.', sourceSectionIds: ['invented'] }],
      missingInformation: [],
    });
    await expect(
      createProcedureAnswerer(dependencies({ generate: async () => bad }), (event) =>
        events.push(event),
      )('private-user', input),
    ).rejects.toMatchObject({ code: 'INVALID_MODEL_OUTPUT' });
    expect(events.filter((e) => e.stage === 'generation').map((e) => [e.state, e.code])).toEqual([
      ['start', undefined],
      ['error', 'INVALID_MODEL_OUTPUT'],
    ]);
  });
});
