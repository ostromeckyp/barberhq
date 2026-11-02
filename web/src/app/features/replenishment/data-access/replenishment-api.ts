import { Service, inject } from '@angular/core';
import { QueryFetchPolicy } from 'firebase/data-connect';
import type { CommandOp } from '../../../../../../shared/contracts/functions/index';
import { callFunction } from '../../../core/call-function';
import { FIREBASE } from '../../../core/firebase.providers';
import * as sdk from '../../../core/generated';
import { InventoryApi } from '../../salon-dashboard/data-access/inventory-api';
import type {
  StockAction,
  CommandResult,
  RequestSummary,
  RequestDetail,
  RequestFilter,
} from '../../../../../../shared/contracts/stock/index';
import type { Page, PageInput } from '../../../../../../shared/contracts/business/index';
import { commandError } from './command-error';
import { toRequestSummary, toRequestDetail } from './request.mapper';
const names: Record<StockAction['type'], CommandOp> = {
  SUBMIT: 'submitRequest',
  APPROVE: 'approveRequest',
  REJECT: 'rejectRequest',
  DISPATCH: 'dispatchTransfer',
  RECEIVE: 'receiveTransfer',
};
const policy = { fetchPolicy: QueryFetchPolicy.SERVER_ONLY };
@Service()
export class ReplenishmentApi {
  private readonly firebase = inject(FIREBASE);
  private readonly inventory = inject(InventoryApi);
  async runAction(action: StockAction): Promise<CommandResult> {
    try {
      return await callFunction<StockAction['input'], CommandResult>(
        this.firebase,
        names[action.type],
        action.input,
      );
    } catch (error) {
      throw commandError(error);
    }
  }
  async listActive(salonId: string): Promise<RequestSummary[]> {
    const { data } = await sdk.listActiveRequests(
      this.firebase.data,
      { salonId, limit: 100, offset: 0 },
      policy,
    );
    return data.membership?.business.requests.map(toRequestSummary) ?? [];
  }
  async listHQQueue(page: PageInput): Promise<Page<RequestSummary>> {
    const { data } = await sdk.listHqQueue(this.firebase.data, page, policy);
    const items = data.membership?.business.requests.map(toRequestSummary) ?? [];
    return { items, nextOffset: items.length === page.limit ? page.offset + page.limit : null };
  }
  async getRequest(requestId: string): Promise<RequestDetail> {
    const { data } = await sdk.getRequestDetail(this.firebase.data, { requestId }, policy);
    const r = data.membership?.business.requests[0];
    if (!r) throw new Error('Request unavailable.');
    return toRequestDetail(r, await this.inventory.getInventory(r.salonId));
  }
  async listRequests(
    salonId: string,
    filter: RequestFilter,
    page: PageInput,
  ): Promise<Page<RequestSummary>> {
    const states =
      filter === 'ALL'
        ? Object.values(sdk.RequestState)
        : filter === 'ACTIVE'
          ? [
              sdk.RequestState.PENDING_APPROVAL,
              sdk.RequestState.RESERVED,
              sdk.RequestState.DISPATCHED,
            ]
          : filter === 'RECEIVED'
            ? [sdk.RequestState.RECEIVED, sdk.RequestState.RECEIVED_WITH_ISSUE]
            : [sdk.RequestState[filter]];
    const { data } = await sdk.listSalonRequests(
      this.firebase.data,
      { salonId, states, ...page },
      policy,
    );
    const items = data.membership?.business.requests.map(toRequestSummary) ?? [];
    return { items, nextOffset: items.length === page.limit ? page.offset + page.limit : null };
  }
}
