export type SourceResponse = {
  status(code: number): SourceResponse;
  set(name: string, value: string): SourceResponse;
  send(body: unknown): SourceResponse;
  end(): SourceResponse;
};
