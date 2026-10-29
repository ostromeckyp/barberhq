import type { DispatchService } from '../queue.js';
import type { KnowledgeRepository } from '../repository.js';

export type UploadDeps = {
  repo: Pick<KnowledgeRepository, 'dc' | 'version' | 'putOriginal' | 'bucket'>;
  dispatch: Pick<DispatchService, 'dispatch'>;
  origins: string[];
  emulator: boolean;
  verifyAuth(token: string): Promise<string | null>;
  verifyAppCheck(token: string): Promise<boolean>;
};
