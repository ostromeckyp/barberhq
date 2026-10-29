import type { AddIssueNoteInput } from './add-issue-note-input.js';
import type { IssueTransitionInput } from './issue-transition-input.js';
import type { RecordDeliveryInput } from './record-delivery-input.js';
import type { SetDeliveryProcedureInput } from './set-delivery-procedure-input.js';
export type DeliveryAction =
  | { type: 'RECORD_RECEIPT'; input: RecordDeliveryInput }
  | { type: 'START_REVIEW' | 'CREATE_REPLACEMENT'; input: IssueTransitionInput }
  | { type: 'ADD_NOTE'; input: AddIssueNoteInput }
  | { type: 'SET_PROCEDURE'; input: SetDeliveryProcedureInput };
