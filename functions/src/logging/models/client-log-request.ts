export type ClientLogRequest = {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
};
