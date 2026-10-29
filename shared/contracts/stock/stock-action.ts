import type { ApproveInput } from './approve-input.js';
import type { ReceiveInput } from './receive-input.js';
import type { RejectInput } from './reject-input.js';
import type { SubmitInput } from './submit-input.js';
import type { TransitionInput } from './transition-input.js';
export type StockAction =
  | { type: 'SUBMIT'; input: SubmitInput }
  | { type: 'APPROVE'; input: ApproveInput }
  | { type: 'REJECT'; input: RejectInput }
  | { type: 'DISPATCH'; input: TransitionInput }
  | { type: 'RECEIVE'; input: ReceiveInput };
