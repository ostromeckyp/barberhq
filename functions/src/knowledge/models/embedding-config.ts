import type { EmbeddingTaskType } from './embedding-task-type.js';

export interface EmbeddingConfig {
  provider: 'vertex';
  projectId: string;
  modelId: string;
  dimension: number;
  documentMode: EmbeddingTaskType;
  queryMode: EmbeddingTaskType;
  location: string;
  configHash: string;
}
