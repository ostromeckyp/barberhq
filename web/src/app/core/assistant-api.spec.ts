import { TestBed } from '@angular/core/testing';
import { httpsCallable } from 'firebase/functions';
import { beforeEach, expect, it, vi } from 'vitest';
import { FIREBASE } from './firebase.providers';
import { AssistantApi, AssistantApiError } from './assistant-api';
import { Language } from './language';

vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  TestBed.configureTestingModule({
    providers: [
      AssistantApi,
      { provide: FIREBASE, useValue: { functions: {}, appCheck: () => Promise.resolve(null) } },
    ],
  });
});

it('calls the procedure function with the English request and returns its result', async () => {
  const call = vi.fn().mockResolvedValue({
    data: { status: 'INSUFFICIENT_EVIDENCE', message: 'No source supports this.', sources: [] },
  });
  vi.mocked(httpsCallable).mockReturnValue(Object.assign(call, { stream: vi.fn() }));
  const api = TestBed.inject(AssistantApi);
  await expect(
    api.answerProcedureQuestion({ question: 'What do I do?', answerLanguage: 'en' }),
  ).resolves.toEqual({
    status: 'INSUFFICIENT_EVIDENCE',
    message: 'No source supports this.',
    sources: [],
  });
  expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'ai');
  expect(call).toHaveBeenCalledWith({
    op: 'answerProcedureQuestion',
    input: { question: 'What do I do?', answerLanguage: 'en' },
  });
});

it('maps controlled callable details without exposing provider errors', async () => {
  const call = vi.fn().mockRejectedValue({
    code: 'functions/aborted',
    message: 'private provider detail',
    details: { code: 'SOURCE_CHANGED' },
  });
  vi.mocked(httpsCallable).mockReturnValue(Object.assign(call, { stream: vi.fn() }));
  const api = TestBed.inject(AssistantApi);
  await expect(
    api.answerProcedureQuestion({ question: 'What do I do?', answerLanguage: 'en' }),
  ).rejects.toMatchObject({
    code: 'SOURCE_CHANGED',
    key: 'procedures.assistant.errors.SOURCE_CHANGED',
  });
  expect(AssistantApiError).toBeDefined();
});

it('rejects an answer step whose citation is absent from the returned sources', async () => {
  const call = vi.fn().mockResolvedValue({
    data: {
      status: 'ANSWER',
      steps: [{ text: 'Replace it automatically.', sourceSectionIds: ['missing'] }],
      sources: [],
      missingInformation: [],
    },
  });
  vi.mocked(httpsCallable).mockReturnValue(Object.assign(call, { stream: vi.fn() }));
  const api = TestBed.inject(AssistantApi);
  await expect(
    api.answerProcedureQuestion({ question: 'What now?', answerLanguage: 'en' }),
  ).rejects.toMatchObject({ code: 'INVALID_MODEL_OUTPUT' });
});
it('returns only a valid replenishment proposal and rejects malformed stock', async () => {
  const proposal = {
    status: 'PROPOSAL',
    lines: [
      {
        status: 'READY',
        lineId: 'line-0-8',
        productId: 'matowa',
        productName: 'Matowa',
        quantity: 2,
        origin: 'assistant',
        hqAvailable: 18,
        salonOnHand: 2,
        hqInventoryVersion: 1,
        salonInventoryVersion: 1,
      },
    ],
    excluded: [],
    toolEvents: [],
  };
  const call = vi
    .fn()
    .mockResolvedValueOnce({ data: proposal })
    .mockResolvedValueOnce({
      data: { ...proposal, lines: [{ ...proposal.lines[0], hqAvailable: -1 }] },
    });
  vi.mocked(httpsCallable).mockReturnValue(Object.assign(call, { stream: vi.fn() }));
  const api = TestBed.inject(AssistantApi);
  await expect(
    api.prepareReplenishment({ salonId: 'salon', message: '2 Matowa' }),
  ).resolves.toEqual(proposal);
  await expect(
    api.prepareReplenishment({ salonId: 'salon', message: '2 Matowa' }),
  ).rejects.toMatchObject({ code: 'INVALID_MODEL_OUTPUT' });
  expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'ai');
});

it('accepts canonical product-card citations and rejects inconsistent provenance', async () => {
  const source = {
    chunkId: 'c1',
    sourceSectionId: 'c1',
    versionId: 'v1',
    title: 'Product information',
    version: 'v1',
    excerpt: 'Reviewed information',
    physicalPage: 1,
    kind: 'product-card',
    origin: 'synthetic',
    synthetic: true,
    superseded: false,
  };
  const answer = {
    status: 'ANSWER',
    steps: [{ text: 'Read the supplied information.', sourceSectionIds: ['c1'] }],
    sources: [source],
    missingInformation: [],
  };
  const call = vi
    .fn()
    .mockResolvedValueOnce({ data: answer })
    .mockResolvedValueOnce({ data: { ...answer, sources: [{ ...source, synthetic: false }] } });
  vi.mocked(httpsCallable).mockReturnValue(Object.assign(call, { stream: vi.fn() }));
  const api = TestBed.inject(AssistantApi);
  await expect(
    api.answerProcedureQuestion({ question: 'What now?', answerLanguage: 'en' }),
  ).resolves.toMatchObject(answer);
  await expect(
    api.answerProcedureQuestion({ question: 'What now?', answerLanguage: 'en' }),
  ).rejects.toMatchObject({ code: 'INVALID_MODEL_OUTPUT' });
});

it('transcribes an order recording and returns the text', async () => {
  const call = vi.fn().mockResolvedValue({ data: { text: 'two matte clay' } });
  vi.mocked(httpsCallable).mockReturnValue(Object.assign(call, { stream: vi.fn() }));
  const api = TestBed.inject(AssistantApi);
  const input = {
    salonId: 'salon',
    audio: 'QUJD',
    mimeType: 'audio/webm',
    language: 'en' as const,
  };
  await expect(api.transcribeOrder(input)).resolves.toBe('two matte clay');
  expect(call).toHaveBeenCalledWith({ op: 'transcribeOrder', input });
});

it('maps NO_SPEECH to its own code and message key', async () => {
  const call = vi.fn().mockRejectedValue({
    code: 'functions/failed-precondition',
    details: { code: 'NO_SPEECH' },
  });
  vi.mocked(httpsCallable).mockReturnValue(Object.assign(call, { stream: vi.fn() }));
  const api = TestBed.inject(AssistantApi);
  await expect(
    api.transcribeOrder({
      salonId: 'salon',
      audio: 'QUJD',
      mimeType: 'audio/webm',
      language: 'pl',
    }),
  ).rejects.toMatchObject({ code: 'NO_SPEECH', key: 'procedures.assistant.errors.NO_SPEECH' });
});

it('sends the UI language with prepareReplenishment', async () => {
  const call = vi.fn().mockResolvedValue({ data: { status: 'PROPOSAL', lines: 'bad' } });
  vi.mocked(httpsCallable).mockReturnValue(Object.assign(call, { stream: vi.fn() }));
  TestBed.inject(Language).set('pl');
  const api = TestBed.inject(AssistantApi);
  await api.prepareReplenishment({ salonId: 'salon', message: '2 Matowa' }).catch(() => undefined);
  expect(call).toHaveBeenCalledWith({
    op: 'prepareReplenishment',
    input: { salonId: 'salon', message: '2 Matowa', language: 'pl' },
  });
});
