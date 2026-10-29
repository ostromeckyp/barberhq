import type { DeliveryAction } from '../../../../../../shared/contracts/delivery/index';

export type IssueAction =
  | Extract<DeliveryAction, { type: 'ADD_NOTE' }>
  | {
      type: 'START_REVIEW' | 'CREATE_REPLACEMENT';
      input: { issueId: string; expectedRevision: number; idempotencyKey: string };
    };
