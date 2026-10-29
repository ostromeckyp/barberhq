export type UploadResponse = {
  status(code: number): UploadResponse;
  set(name: string, value: string): UploadResponse;
  send(body: unknown): UploadResponse;
  end(): UploadResponse;
};
