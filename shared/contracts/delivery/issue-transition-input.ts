export type IssueTransitionInput = {
  issueId: string;
  expectedRevision: number;
  idempotencyKey: string;
};
