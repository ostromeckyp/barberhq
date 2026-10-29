export type RagRetrievalConfig = {
  maxChunks: 3;
  maxCosineDistance: number;
  embeddingConfigHash: string;
  evaluationSetHash: string;
};
