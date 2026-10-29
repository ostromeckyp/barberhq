export type TransitionInput = {
  requestId: string;
  expectedRevision: number;
  idempotencyKey: string;
};
