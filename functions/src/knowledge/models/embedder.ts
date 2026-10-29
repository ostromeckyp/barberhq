import type { EmbeddingConfig } from './embedding-config.js';
import type { EmbeddingMode } from './embedding-mode.js';

export type Embedder = {
  config: EmbeddingConfig;
  embedTexts(texts: string[], mode: EmbeddingMode): Promise<number[][]>;
};
