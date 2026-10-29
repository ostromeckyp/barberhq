import type { EmbeddingConfig } from './embedding-config.js';

export interface EmbeddingConfigInput extends Omit<EmbeddingConfig, 'provider' | 'configHash'> {
  provider?: 'vertex';
}
