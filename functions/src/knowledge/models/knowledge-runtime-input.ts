export type KnowledgeRuntimeInput = {
  emulator: boolean;
  projectId?: string;
  authHost?: string;
  sqlHost?: string;
  firebaseStorageHost?: string;
  storageHost?: string;
  serviceId?: string;
  sqlLocation?: string;
  bucket?: string;
  vertexProject?: string;
  vertexModel?: string;
  vertexLocation?: string;
  vertexDimension?: string;
};
