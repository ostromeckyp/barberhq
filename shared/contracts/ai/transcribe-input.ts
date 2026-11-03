/** Recorded order audio, base64 encoded (at most 1 MiB decoded). */
export type TranscribeInput = {
  salonId: string;
  audio: string;
  mimeType: string;
  language: 'pl' | 'en';
};
