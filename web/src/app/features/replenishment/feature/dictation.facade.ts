import { DestroyRef, Service, computed, inject, signal } from '@angular/core';
import { AssistantApi, AssistantApiError } from '../../../core/assistant-api';
import { ClientLog } from '../../../core/client-log';
import { Language } from '../../../core/language';
import { runtimeConfig } from '../../../core/public-config';
import { MicrophoneBlockedError, VoiceRecorder } from '../../../core/voice-recorder';
import type { DictationState } from '../models/dictation-state';
import { OrderFacade } from './order.facade';
import { ReplenishmentAssistantFacade } from './replenishment-assistant.facade';

export const MAX_RECORDING_MS = 30_000;
export const STOP_TIMEOUT_MS = 5_000;
export const RECOGNITION_TIMEOUT_MS = 40_000;
const MAX_LENGTH = 2000;
type Recording = { blob: Blob; mimeType: string };
const TIMED_OUT = Symbol('timed out');

/** Settles with `TIMED_OUT` when `work` has not settled within `ms`. */
function within<T>(work: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });
  return Promise.race([work, limit]).finally(() => clearTimeout(timer));
}

/** Appends dictated text to the message; the result is capped at the form's maximum length. */
export function appendDictation(
  existing: string,
  text: string,
): { value: string; capped: boolean } {
  const joined = existing.trim() ? `${existing}, ${text}` : text;
  const chars = [...joined];
  return chars.length > MAX_LENGTH
    ? { value: chars.slice(0, MAX_LENGTH).join(''), capped: true }
    : { value: joined, capped: false };
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

@Service({ autoProvided: false })
export class DictationFacade {
  private readonly recorder = inject(VoiceRecorder);
  private readonly api = inject(AssistantApi);
  private readonly language = inject(Language);
  private readonly order = inject(OrderFacade);
  private readonly assistant = inject(ReplenishmentAssistantFacade);
  private readonly log = inject(ClientLog);
  private attempt = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private startedAt = 0;
  private last: Recording | null = null;
  private destroyed = false;
  readonly state = signal<DictationState>('idle');
  readonly elapsedMs = signal(0);
  readonly errorKey = signal<string | null>(null);
  readonly visible = computed(
    () =>
      (runtimeConfig.publicConfig?.replenishmentAiEnabled ?? false) && this.recorder.supported(),
  );
  readonly disabled = computed(() => this.assistant.loading() || this.order.locked());
  readonly canRetry = computed(() => this.state() === 'error' && this.last !== null);
  readonly level = this.recorder.level;
  private readonly onHidden = () => {
    if (document.visibilityState === 'hidden' && this.state() === 'recording') void this.finish();
  };

  constructor() {
    document.addEventListener('visibilitychange', this.onHidden);
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      document.removeEventListener('visibilitychange', this.onHidden);
      this.clearTimer();
      if (this.state() === 'recording') void this.recorder.stop().catch(() => undefined);
    });
  }

  async toggle(): Promise<void> {
    if (this.state() === 'recording') return this.finish();
    if (this.state() === 'recognising' || this.state() === 'starting' || this.disabled()) return;
    this.errorKey.set(null);
    this.state.set('starting');
    try {
      await this.recorder.start();
    } catch (error) {
      if (this.destroyed) return;
      const blocked = error instanceof MicrophoneBlockedError;
      this.log.record('dictation.start', 'error', { code: blocked ? 'blocked' : 'failed' });
      this.fail(
        error instanceof MicrophoneBlockedError
          ? 'replenishment.dictation.blocked'
          : 'replenishment.dictation.failed',
      );
      return;
    }
    if (this.destroyed) {
      void this.recorder.stop().catch(() => undefined);
      return;
    }
    this.log.record('dictation.start');
    this.last = null;
    this.state.set('recording');
    this.elapsedMs.set(0);
    this.startedAt = Date.now();
    this.timer = setInterval(() => {
      const elapsed = Date.now() - this.startedAt;
      this.elapsedMs.set(Math.min(elapsed, MAX_RECORDING_MS));
      if (elapsed >= MAX_RECORDING_MS) void this.finish();
    }, 250);
  }

  async retry(): Promise<void> {
    if (this.state() !== 'error' || !this.last) return;
    this.log.record('dictation.retry');
    await this.transcribe(this.last);
  }

  private async finish(): Promise<void> {
    if (this.state() !== 'recording') return;
    this.clearTimer();
    this.state.set('recognising');
    try {
      const stopped = await within(this.recorder.stop(), STOP_TIMEOUT_MS);
      if (this.destroyed) return;
      if (stopped === TIMED_OUT) {
        this.recorder.cancel();
        this.last = null;
        this.log.record('dictation.stop.timeout', 'error');
        this.fail('replenishment.dictation.failed');
        return;
      }
      const { blob, mimeType, durationMs } = stopped;
      this.log.record('dictation.stop', 'ok', {
        details: { bytes: blob.size, mimeType, durationMs },
      });
      if (blob.size === 0) {
        this.last = null;
        this.fail('replenishment.dictation.noSpeech');
        return;
      }
      this.last = { blob, mimeType };
    } catch {
      if (this.destroyed) return;
      this.log.record('dictation.stop', 'error');
      this.fail('replenishment.dictation.failed');
      return;
    }
    await this.transcribe(this.last);
  }

  private async transcribe(recording: Recording): Promise<void> {
    const attempt = ++this.attempt;
    this.state.set('recognising');
    this.errorKey.set(null);
    try {
      const recognised = await within(
        (async () => {
          const audio = await toBase64(recording.blob);
          this.log.record('dictation.encoded', 'ok', { details: { bytes: recording.blob.size } });
          return this.api.transcribeOrder({
            salonId: this.order.salonId() ?? '',
            audio,
            mimeType: recording.mimeType,
            language: this.language.current(),
          });
        })(),
        RECOGNITION_TIMEOUT_MS,
      );
      if (this.destroyed || attempt !== this.attempt) return;
      if (recognised === TIMED_OUT) {
        this.attempt++;
        this.log.record('dictation.timeout', 'error');
        this.fail('replenishment.dictation.failed');
        return;
      }
      const text = recognised;
      this.log.record('dictation.result', 'ok', { details: { chars: [...text.trim()].length } });
      if (this.disabled()) {
        this.state.set('idle');
        return;
      }
      const result = appendDictation(this.assistant.message(), text.trim());
      this.assistant.message.set(result.value);
      this.last = null;
      this.state.set('idle');
      if (result.capped) this.errorKey.set('replenishment.dictation.tooLong');
    } catch (error) {
      if (this.destroyed || attempt !== this.attempt) return;
      const code = error instanceof AssistantApiError ? error.code : null;
      this.log.record('dictation.result', 'error', { code: code ?? 'unknown' });
      if (code === 'NO_SPEECH') this.last = null;
      this.fail(
        code === 'NO_SPEECH'
          ? 'replenishment.dictation.noSpeech'
          : code === 'RATE_LIMITED'
            ? 'replenishment.assistant.errors.RATE_LIMITED'
            : 'replenishment.dictation.failed',
      );
    }
  }

  private fail(key: string): void {
    this.errorKey.set(key);
    this.state.set('error');
  }

  private clearTimer(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }
}
