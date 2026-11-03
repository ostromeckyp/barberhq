export type ClientLogResponse = {
  status(code: number): ClientLogResponse;
  set(name: string, value: string): ClientLogResponse;
  send(body: unknown): ClientLogResponse;
  end(): ClientLogResponse;
};
