import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AssistantApi, AssistantApiError } from '../../../core/assistant-api';
import { Language } from '../../../core/language';
import { MicrophoneBlockedError, VoiceRecorder } from '../../../core/voice-recorder';
import { ClientLog } from '../../../core/client-log';
import {
  DictationFacade,
  RECOGNITION_TIMEOUT_MS,
  STOP_TIMEOUT_MS,
  appendDictation,
} from './dictation.facade';
import { OrderFacade } from './order.facade';
import { ReplenishmentAssistantFacade } from './replenishment-assistant.facade';

let start: ReturnType<typeof vi.fn>;
let stop: ReturnType<typeof vi.fn>;
let cancel: ReturnType<typeof vi.fn>;
let transcribe: ReturnType<typeof vi.fn>;
let record: ReturnType<typeof vi.fn>;
let message: ReturnType<typeof signal<string>>;
let locked: ReturnType<typeof signal<boolean>>;
let loading: ReturnType<typeof signal<boolean>>;
function setup() {
  message = signal('');
  locked = signal(false);
  loading = signal(false);
  TestBed.configureTestingModule({
    providers: [
      DictationFacade,
      {
        provide: VoiceRecorder,
        useValue: { supported: () => true, start, stop, cancel, level: signal(0) },
      },
      { provide: AssistantApi, useValue: { transcribeOrder: transcribe } },
      { provide: Language, useValue: { current: () => 'pl' } },
      { provide: OrderFacade, useValue: { salonId: () => 'salon', locked } },
      { provide: ReplenishmentAssistantFacade, useValue: { message, loading } },
      {
        provide: ClientLog,
        useValue: {
          get record() {
            return record;
          },
        },
      },
    ],
  });
  return TestBed.inject(DictationFacade);
}
beforeEach(() => {
  vi.useFakeTimers();
  start = vi.fn(async () => undefined);
  stop = vi.fn(async () => ({
    blob: new Blob(['abc'], { type: 'audio/mp4' }),
    mimeType: 'audio/mp4',
    durationMs: 1000,
  }));
  transcribe = vi.fn(async () => '2 matowa');
  record = vi.fn();
  cancel = vi.fn();
});
afterEach(() => vi.useRealTimers());

it('records, ticks, then transcribes and appends the text', async () => {
  const facade = setup();
  await facade.toggle();
  expect(facade.state()).toBe('recording');
  await vi.advanceTimersByTimeAsync(2000);
  expect(facade.elapsedMs()).toBeGreaterThanOrEqual(2000);
  await facade.toggle();
  expect(transcribe).toHaveBeenCalledWith({
    salonId: 'salon',
    audio: btoa('abc'),
    mimeType: 'audio/mp4',
    language: 'pl',
  });
  expect(message()).toBe('2 matowa');
  expect(facade.state()).toBe('idle');
});

it('auto-stops at 30 seconds', async () => {
  const facade = setup();
  await facade.toggle();
  await vi.advanceTimersByTimeAsync(30_500);
  expect(stop).toHaveBeenCalled();
  expect(facade.state()).toBe('idle');
});

it('stops and transcribes when the tab becomes hidden', async () => {
  const facade = setup();
  await facade.toggle();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  document.dispatchEvent(new Event('visibilitychange'));
  await vi.advanceTimersByTimeAsync(0);
  expect(stop).toHaveBeenCalled();
  expect(transcribe).toHaveBeenCalled();
});

it('maps a blocked microphone and stays usable', async () => {
  start.mockRejectedValue(new MicrophoneBlockedError());
  const facade = setup();
  await facade.toggle();
  expect(facade.errorKey()).toBe('replenishment.dictation.blocked');
  start.mockResolvedValue(undefined);
  await facade.toggle();
  expect(facade.state()).toBe('recording');
  expect(facade.errorKey()).toBeNull();
});

it('maps NO_SPEECH and RATE_LIMITED', async () => {
  const facade = setup();
  transcribe.mockRejectedValueOnce(new AssistantApiError('NO_SPEECH'));
  await facade.toggle();
  await facade.toggle();
  expect(facade.errorKey()).toBe('replenishment.dictation.noSpeech');
  expect(facade.canRetry()).toBe(false);
  transcribe.mockRejectedValueOnce(new AssistantApiError('RATE_LIMITED'));
  await facade.toggle();
  await facade.toggle();
  expect(facade.errorKey()).toBe('replenishment.assistant.errors.RATE_LIMITED');
});

it('retries the same recording after a provider failure', async () => {
  const facade = setup();
  transcribe.mockRejectedValueOnce(new Error('down'));
  await facade.toggle();
  await facade.toggle();
  expect(facade.errorKey()).toBe('replenishment.dictation.failed');
  expect(facade.canRetry()).toBe(true);
  await facade.retry();
  expect(stop).toHaveBeenCalledTimes(1);
  expect(transcribe).toHaveBeenCalledTimes(2);
  expect(transcribe.mock.calls[1][0]).toEqual(transcribe.mock.calls[0][0]);
  expect(message()).toBe('2 matowa');
});

it('shows tooLong when the appended text is capped', async () => {
  const facade = setup();
  message.set('x'.repeat(1999));
  await facade.toggle();
  await facade.toggle();
  expect([...message()].length).toBe(2000);
  expect(facade.errorKey()).toBe('replenishment.dictation.tooLong');
});

it('appends with a comma and caps at 2000', () => {
  expect(appendDictation('', 'a')).toEqual({ value: 'a', capped: false });
  expect(appendDictation('b', 'a')).toEqual({ value: 'b, a', capped: false });
  expect(appendDictation('x'.repeat(2000), 'a').capped).toBe(true);
});

it('ignores a second tap while the microphone is starting', async () => {
  let resolve!: () => void;
  start.mockImplementation(() => new Promise<void>((r) => (resolve = r)));
  const facade = setup();
  const first = facade.toggle();
  await facade.toggle();
  expect(facade.state()).toBe('starting');
  resolve();
  await first;
  expect(start).toHaveBeenCalledTimes(1);
  expect(facade.state()).toBe('recording');
  expect(vi.getTimerCount()).toBe(1);
});

it('stops the recorder when destroyed while starting', async () => {
  let resolve!: () => void;
  start.mockImplementation(() => new Promise<void>((r) => (resolve = r)));
  const facade = setup();
  const first = facade.toggle();
  TestBed.resetTestingModule();
  resolve();
  await first;
  expect(stop).toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
  expect(facade.state()).not.toBe('recording');
});

it('does not write after destroy during recognising', async () => {
  let done!: (t: string) => void;
  transcribe.mockImplementation(() => new Promise<string>((r) => (done = r)));
  const facade = setup();
  await facade.toggle();
  const finishing = facade.toggle();
  await vi.advanceTimersByTimeAsync(0);
  TestBed.resetTestingModule();
  done('late');
  await finishing;
  expect(message()).toBe('');
});

it('reports noSpeech for an empty recording without calling the server', async () => {
  stop.mockResolvedValue({ blob: new Blob([]), mimeType: 'audio/mp4', durationMs: 10 });
  const facade = setup();
  await facade.toggle();
  await facade.toggle();
  expect(transcribe).not.toHaveBeenCalled();
  expect(facade.errorKey()).toBe('replenishment.dictation.noSpeech');
  expect(facade.canRetry()).toBe(false);
});

it('does nothing while the form is locked or loading', async () => {
  const facade = setup();
  locked.set(true);
  expect(facade.disabled()).toBe(true);
  await facade.toggle();
  expect(start).not.toHaveBeenCalled();
  locked.set(false);
  loading.set(true);
  await facade.toggle();
  expect(start).not.toHaveBeenCalled();
});

it('skips the write when the form locks during recognising', async () => {
  let done!: (t: string) => void;
  transcribe.mockImplementation(() => new Promise<string>((r) => (done = r)));
  const facade = setup();
  await facade.toggle();
  const finishing = facade.toggle();
  await vi.advanceTimersByTimeAsync(0);
  locked.set(true);
  done('late');
  await finishing;
  expect(message()).toBe('');
  expect(facade.state()).toBe('idle');
});

const events = () => record.mock.calls.map((call) => call[0]);

it('uses a 5 s stop limit and a 40 s recognition limit', () => {
  expect(STOP_TIMEOUT_MS).toBe(5_000);
  expect(RECOGNITION_TIMEOUT_MS).toBe(40_000);
});

it('fails without retry when the recorder never stops', async () => {
  stop.mockImplementation(() => new Promise(() => undefined));
  const facade = setup();
  await facade.toggle();
  void facade.toggle();
  await vi.advanceTimersByTimeAsync(4_900);
  expect(facade.state()).toBe('recognising');
  await vi.advanceTimersByTimeAsync(200);
  expect(facade.state()).toBe('error');
  expect(facade.errorKey()).toBe('replenishment.dictation.failed');
  expect(facade.canRetry()).toBe(false);
  expect(events()).toContain('dictation.stop.timeout');
  expect(cancel).toHaveBeenCalled();
  expect(transcribe).not.toHaveBeenCalled();
});

it('fails with retry when recognition does not answer in 40 s', async () => {
  transcribe.mockImplementation(() => new Promise(() => undefined));
  const facade = setup();
  await facade.toggle();
  void facade.toggle();
  await vi.advanceTimersByTimeAsync(39_000);
  expect(facade.state()).toBe('recognising');
  await vi.advanceTimersByTimeAsync(1_100);
  expect(facade.state()).toBe('error');
  expect(facade.canRetry()).toBe(true);
  expect(events()).toContain('dictation.timeout');
});

it('ignores a transcription that arrives after the time limit', async () => {
  let answer!: (text: string) => void;
  transcribe.mockImplementation(() => new Promise<string>((resolve) => (answer = resolve)));
  const facade = setup();
  await facade.toggle();
  void facade.toggle();
  await vi.advanceTimersByTimeAsync(41_000);
  expect(facade.state()).toBe('error');
  answer('late text');
  await vi.advanceTimersByTimeAsync(0);
  expect(message()).toBe('');
  expect(facade.state()).toBe('error');
});

it('logs the steps of a successful dictation without the transcript', async () => {
  const facade = setup();
  await facade.toggle();
  await vi.advanceTimersByTimeAsync(1_000);
  await facade.toggle();
  expect(events()).toEqual([
    'dictation.start',
    'dictation.stop',
    'dictation.encoded',
    'dictation.result',
  ]);
  expect(record.mock.calls[1][2].details).toEqual({
    bytes: 3,
    mimeType: 'audio/mp4',
    durationMs: 1000,
  });
  expect(record.mock.calls[3][2].details).toEqual({ chars: 8 });
  expect(JSON.stringify(record.mock.calls)).not.toContain('matowa');
});

it('logs a blocked microphone and an API error code', async () => {
  start.mockRejectedValueOnce(new MicrophoneBlockedError());
  const facade = setup();
  await facade.toggle();
  expect(record).toHaveBeenCalledWith('dictation.start', 'error', { code: 'blocked' });
  transcribe.mockRejectedValueOnce(new AssistantApiError('NO_SPEECH'));
  await facade.toggle();
  await facade.toggle();
  expect(record).toHaveBeenCalledWith(
    'dictation.result',
    'error',
    expect.objectContaining({ code: 'NO_SPEECH' }),
  );
});
