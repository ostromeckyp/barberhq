import type { RequestState } from '../stock/request-state.js';
export type DeliveryReplacementDto = {
  id: string;
  state: RequestState;
  createdAt: string;
};
