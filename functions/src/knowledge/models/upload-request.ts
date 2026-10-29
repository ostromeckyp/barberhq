import type { Headers } from './headers.js';

export type UploadRequest = {
  method: string;
  headers: Headers;
  query: Record<string, unknown>;
  rawBody?: Buffer | Uint8Array;
  [Symbol.asyncIterator]?: () => AsyncIterator<Uint8Array>;
};
