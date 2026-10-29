import type { SubmitInput } from '../stock/submit-input.js';
export type PendingSubmission = {
  version: 2;
  userId: string;
  businessId: string;
  salonId: string;
  payload: SubmitInput;
};
