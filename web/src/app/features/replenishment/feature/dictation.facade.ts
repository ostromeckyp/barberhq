import { DestroyRef, Service, computed, inject, signal } from '@angular/core';
import { AssistantApi, AssistantApiError } from '../../../core/assistant-api';
import { Language } from '../../../core/language';
import { runtimeConfig } from '../../../core/public-config';
import { MicrophoneBlockedError, VoiceRecorder } from '../../../core/voice-recorder';
import type { DictationState } from '../models/dictation-state';
import { OrderFacade } from './order.facade';
import { ReplenishmentAssistantFacade } from './replenishment-assistant.facade';

export const MAX_RECORDING_MS = 30_000;
const MAX_LENGTH = 2000;
type Recording = { blob: Blob; mimeType: string };

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
    await this.transcribe(this.last);
  }

  private async finish(): Promise<void> {
    if (this.state() !== 'recording') return;
    this.clearTimer();
    this.state.set('recognising');
    try {
      const { blob, mimeType } = await this.recorder.stop();
      if (this.destroyed) return;
      if (blob.size === 0) {
        this.last = null;
        this.fail('replenishment.dictation.noSpeech');
        return;
      }
      this.last = { blob, mimeType };
    } catch {
      if (this.destroyed) return;
      this.fail('replenishment.dictation.failed');
      return;
    }
    await this.transcribe(this.last);
  }

  private async transcribe(recording: Recording): Promise<void> {
    this.state.set('recognising');
    this.errorKey.set(null);
    try {
      const text = await this.api.transcribeOrder({
        salonId: this.order.salonId() ?? '',
        audio: await toBase64(recording.blob),
        mimeType: recording.mimeType,
        language: this.language.current(),
      });
      if (this.destroyed) return;
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
      if (this.destroyed) return;
      const code = error instanceof AssistantApiError ? error.code : null;
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
