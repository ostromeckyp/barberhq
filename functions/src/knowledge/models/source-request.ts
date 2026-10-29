export type SourceRequest = {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, unknown>;
};
