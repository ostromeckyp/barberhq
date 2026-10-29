import type { EmbeddingConfig } from '../../knowledge/models/embedding-config.js';

export type RetrievalEmbedding = {
  config: EmbeddingConfig;
  embedTexts(texts: string[], mode: 'query'): Promise<number[][]>;
};
