import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createAiBudget, AiError } from '../../functions/src/ai/budget.ts';
import { publicAiError } from '../../functions/src/ai/errors.ts';
import { createOrderTranscriber } from '../../functions/src/ai/transcription.ts';
import { transcriptionInstruction } from '../../functions/src/ai/transcription-prompt.ts';

const salonActor = {
  uid: 'staff',
  businessId: 'b',
  role: 'SALON' as const,
  salonIds: ['salon'],
};
const audioBytes = Buffer.from('fake-audio-bytes');
const valid = {
  salonId: 'salon',
  audio: audioBytes.toString('base64'),
  mimeType: 'audio/webm',
  language: 'pl',
};

function setup(text = 'dwie matowe', actor: typeof salonActor = salonActor) {
  const calls: string[] = [];
  const log = vi.fn();
  const transcribe = vi.fn(async (_budget: unknown, _req: unknown) => {
    calls.push('transcribe');
    return text;
  });
  const admitAiCall = vi.fn(async (..._args: unknown[]) => {
    calls.push('admit');
    return createAiBudget(Date.now());
  });
  const run = createOrderTranscriber({
    resolveActor: async (uid) => {
      if (!uid) throw new AiError('UNAUTHENTICATED');
      return actor;
    },
    assertSalon: async () => {},
    admitAiCall,
    transcribe,
    log,
  });
  return { run, calls, log, transcribe, admitAiCall };
}

describe('transcribeOrder', () => {
  it('rejects a missing auth uid, a foreign salon and bad input before admission', async () => {
    const { run, admitAiCall } = setup();
    await expect(run('', valid)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await expect(run('staff', { ...valid, salonId: 'foreign' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    const big = Buffer.alloc(1_048_577).toString('base64');
    await expect(run('staff', { ...valid, audio: big })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    await expect(run('staff', { ...valid, mimeType: 'text/plain' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    await expect(run('staff', { ...valid, language: 'de' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(admitAiCall).not.toHaveBeenCalled();
  });

  it('accepts codec parameters and strips them for the provider call', async () => {
    const { run, transcribe } = setup();
    await run('staff', { ...valid, mimeType: 'audio/mp4;codecs=mp4a.40.2' });
    expect(transcribe).toHaveBeenCalledOnce();
  });

  it('restricts audio types to an allowlist, case-insensitively, with parameters', async () => {
    const { run, admitAiCall } = setup();
    for (const mimeType of ['audio/flac', 'audio/x-foo'])
      await expect(run('staff', { ...valid, mimeType })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    expect(admitAiCall).not.toHaveBeenCalled();
    for (const mimeType of ['audio/webm;codecs=opus', 'AUDIO/MP4', 'audio/x-m4a'])
      await run('staff', { ...valid, mimeType });
    expect(admitAiCall).toHaveBeenCalledTimes(3);
  });

  it('admits exactly once before the provider and passes the decoded audio and language', async () => {
    const { run, calls, transcribe, admitAiCall } = setup('  dwie matowe  ');
    expect(await run('staff', valid)).toEqual({ text: 'dwie matowe' });
    expect(calls).toEqual(['admit', 'transcribe']);
    expect(admitAiCall.mock.calls[0]?.[1]).toBe('transcription');
    expect(String(admitAiCall.mock.calls[0]?.[2])).not.toContain(valid.audio);
    const req = transcribe.mock.calls[0]?.[1] as { audio: Buffer; language: string };
    expect(Buffer.isBuffer(req.audio) && req.audio.equals(audioBytes)).toBe(true);
    expect(req.language).toBe('pl');
  });

  it('lets HQ transcribe for any salon', async () => {
    const hq = { uid: 'hq', businessId: 'b', role: 'HQ' as const, salonIds: [] };
    const { run } = setup('x', hq as never);
    expect(await run('hq', { ...valid, salonId: 'other' })).toEqual({ text: 'x' });
  });

  it('reports NO_SPEECH for blank text and cuts long text at 2000 characters', async () => {
    await expect(setup(' \n ').run('staff', valid)).rejects.toMatchObject({ code: 'NO_SPEECH' });
    expect((await setup('a'.repeat(2500)).run('staff', valid)).text).toHaveLength(2000);
  });

  it('maps NO_SPEECH to failed-precondition with details.code', () => {
    try {
      publicAiError(new AiError('NO_SPEECH'));
    } catch (error) {
      expect(error).toMatchObject({ code: 'failed-precondition', details: { code: 'NO_SPEECH' } });
      return;
    }
    throw new Error('expected a throw');
  });

  it('never logs the transcript or the audio', async () => {
    const { run, log } = setup('sekretny transkrypt');
    await run('staff', valid);
    expect(log).toHaveBeenCalled();
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).not.toContain('sekretny');
    expect(logged).not.toContain(valid.audio);
  });
});

describe('transcription instruction', () => {
  const catalog = JSON.parse(readFileSync('docs/not-bad-stuff-products.json', 'utf8')) as {
    products: { name: string }[];
  };
  for (const language of ['pl', 'en'] as const) {
    it(`covers the cleanup rules (${language}) without catalog names`, () => {
      const text = transcriptionInstruction(language);
      for (const rule of [
        'filler',
        'digits',
        'self-correct',
        'comma',
        'exactly as heard',
        'never add products or quantities',
      ])
        expect(text.toLowerCase()).toContain(rule);
      for (const { name } of catalog.products)
        expect(text.toLowerCase()).not.toContain(name.toLowerCase());
    });
  }
  it('names the spoken language', () => {
    expect(transcriptionInstruction('pl')).toContain('Polish');
    expect(transcriptionInstruction('en')).toContain('English');
  });
});
