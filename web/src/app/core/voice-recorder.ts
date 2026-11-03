import { Service, signal } from '@angular/core';

export class MicrophoneBlockedError extends Error {
  constructor() {
    super('Microphone access was blocked');
  }
}

const MIME_TYPES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];

/** The only place that touches `navigator.mediaDevices` and `MediaRecorder`. */
@Service()
export class VoiceRecorder {
  readonly level = signal(0);
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private audioContext: AudioContext | null = null;
  private frame = 0;

  supported(): boolean {
    return (
      typeof MediaRecorder !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia
    );
  }

  async start(): Promise<void> {
    if (this.recorder) return;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1 },
      });
    } catch (error) {
      this.release();
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        throw new MicrophoneBlockedError();
      }
      throw error;
    }
    try {
      const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(this.stream, {
        audioBitsPerSecond: 64000,
        ...(mimeType ? { mimeType } : {}),
      });
      this.chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.chunks.push(event.data);
      };
      this.recorder = recorder;
      this.startedAt = Date.now();
      recorder.start();
      this.watchLevel(this.stream);
    } catch (error) {
      this.release();
      throw error;
    }
  }

  stop(): Promise<{ blob: Blob; mimeType: string; durationMs: number }> {
    const recorder = this.recorder;
    if (!recorder) return Promise.reject(new Error('Not recording'));
    return new Promise((resolve, reject) => {
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || this.chunks[0]?.type || 'audio/webm';
        const blob = new Blob(this.chunks, { type: mimeType });
        const durationMs = Date.now() - this.startedAt;
        this.release();
        resolve({ blob, mimeType, durationMs });
      };
      recorder.onerror = () => {
        this.release();
        reject(new Error('Recording failed'));
      };
      try {
        if (recorder.state === 'inactive') recorder.onstop(new Event('stop'));
        else recorder.stop();
      } catch (error) {
        this.release();
        reject(error);
      }
    });
  }

  private watchLevel(stream: MediaStream): void {
    if (typeof AudioContext === 'undefined') return;
    try {
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      this.audioContext = context;
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
        this.level.set(Math.min(1, peak));
        this.frame = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* The level meter is optional. */
    }
  }

  private release(): void {
    cancelAnimationFrame(this.frame);
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.audioContext?.close().catch(() => undefined);
    this.audioContext = null;
    this.stream = null;
    this.recorder = null;
    this.level.set(0);
  }
}
