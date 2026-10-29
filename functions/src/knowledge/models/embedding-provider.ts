import type { EmbeddingConfig } from './embedding-config.js';
import type { EmbeddingTaskType } from './embedding-task-type.js';

export type EmbeddingProvider = (
  texts: string[],
  taskType: EmbeddingTaskType,
  config: EmbeddingConfig,
) => Promise<number[][]>;
