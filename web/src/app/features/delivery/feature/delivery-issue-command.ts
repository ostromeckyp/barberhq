import type {
  DeliveryCommandResult,
  DeliveryIssueDto,
} from '../../../../../../shared/contracts/delivery/index';
import type { DeliveryApi } from '../data-access/delivery-api';
import type { IssueAction } from '../models/issue-action';

/** A new HQ command on this issue revision, with a fresh idempotency key. */
export function issueAction(
  type: IssueAction['type'],
  issue: Pick<DeliveryIssueDto, 'id' | 'revision'>,
  note: () => string,
): IssueAction {
  const input = {
    issueId: issue.id,
    expectedRevision: issue.revision,
    idempotencyKey: crypto.randomUUID(),
  };
  return type === 'ADD_NOTE' ? { type, input: { ...input, text: note().trim() } } : { type, input };
}

export function sendIssueAction(
  api: DeliveryApi,
  action: IssueAction,
): Promise<DeliveryCommandResult> {
  return action.type === 'ADD_NOTE'
    ? api.addNote(action.input)
    : action.type === 'START_REVIEW'
      ? api.startReview(action.input)
      : api.createReplacement(action.input);
}
