import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MicrophoneBlockedError, VoiceRecorder } from './voice-recorder';

class FakeRecorder {
  static types = ['audio/webm'];
  static isTypeSupported = (t: string) => FakeRecorder.types.includes(t);
  static last: FakeRecorder;
  state = 'inactive';
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(
    public stream: unknown,
    public options: { mimeType?: string; audioBitsPerSecond?: number },
  ) {
    this.mimeType = options.mimeType ?? '';
    FakeRecorder.last = this;
  }
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['abc'], { type: this.mimeType }) });
    this.onstop?.();
  }
}

const track = { stop: vi.fn() };
let getUserMedia: ReturnType<typeof vi.fn>;
beforeEach(() => {
  track.stop.mockClear();
  getUserMedia = vi.fn(async () => ({ getTracks: () => [track] }));
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  });
});
afterEach(() => vi.unstubAllGlobals());

it('reports support only when MediaRecorder and getUserMedia exist', () => {
  expect(TestBed.inject(VoiceRecorder).supported()).toBe(true);
  vi.stubGlobal('MediaRecorder', undefined);
  expect(TestBed.inject(VoiceRecorder).supported()).toBe(false);
});

it('records mono 64 kbps with the first supported type and releases tracks on stop', async () => {
  const recorder = TestBed.inject(VoiceRecorder);
  await recorder.start();
  expect(getUserMedia).toHaveBeenCalledWith({ audio: { channelCount: 1 } });
  expect(FakeRecorder.last.options).toEqual({
    audioBitsPerSecond: 64000,
    mimeType: 'audio/webm',
  });
  const result = await recorder.stop();
  expect(result.mimeType).toBe('audio/webm');
  expect(result.blob.size).toBe(3);
  expect(track.stop).toHaveBeenCalled();
});

it('throws MicrophoneBlockedError when permission is denied', async () => {
  getUserMedia.mockRejectedValue(new DOMException('no', 'NotAllowedError'));
  await expect(TestBed.inject(VoiceRecorder).start()).rejects.toBeInstanceOf(
    MicrophoneBlockedError,
  );
});

it('releases tracks when the recorder cannot be created', async () => {
  vi.stubGlobal(
    'MediaRecorder',
    class {
      static isTypeSupported = () => false;
      constructor() {
        throw new Error('boom');
      }
    },
  );
  await expect(TestBed.inject(VoiceRecorder).start()).rejects.toThrow('boom');
  expect(track.stop).toHaveBeenCalled();
});

it('ignores a second start while the first is pending', async () => {
  let resolve!: (s: unknown) => void;
  getUserMedia.mockImplementation(() => new Promise((r) => (resolve = r)));
  const recorder = TestBed.inject(VoiceRecorder);
  const first = recorder.start();
  await recorder.start();
  resolve({ getTracks: () => [track] });
  await first;
  expect(getUserMedia).toHaveBeenCalledTimes(1);
});
