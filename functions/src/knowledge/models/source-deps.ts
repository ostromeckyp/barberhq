import type { PdfIdentity } from './pdf-identity.js';

export type SourceDeps = {
  origins: string[];
  emulator: boolean;
  verifyAuth(token: string): Promise<string | null>;
  verifyAppCheck(token: string): Promise<boolean>;
  resolve(uid: string, versionId: string): Promise<PdfIdentity | null>;
  readOriginal(identity: PdfIdentity): Promise<Uint8Array>;
};
