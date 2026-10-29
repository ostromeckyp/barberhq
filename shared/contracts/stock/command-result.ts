import type { RequestState } from './request-state.js';
export type CommandResult = {
  actionReceiptId: string;
  requestId: string;
  state: RequestState;
  revision: number;
  replayed: boolean;
};
