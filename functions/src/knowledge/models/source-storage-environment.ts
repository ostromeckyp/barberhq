export type SourceStorageEnvironment = {
  emulator: boolean;
  projectId: string | undefined;
  cloudBucket: string;
  firebaseStorageHost: string | undefined;
  storageHost: string | undefined;
};
