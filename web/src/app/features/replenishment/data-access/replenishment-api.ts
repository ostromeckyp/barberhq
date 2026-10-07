import { Service, inject } from '@angular/core';
import { httpsCallable } from 'firebase/functions';
import { QueryFetchPolicy } from 'firebase/data-connect';
import { FIREBASE } from '../../../core/firebase.providers';
import * as sdk from '../../../core/generated';
import { InventoryApi } from '../../salon-dashboard/data-access/inventory-api';
import type {
  StockAction,
  CommandResult,
  RequestSummary,
  RequestDetail,
  RequestState,
} from '../../../../../../shared/contracts/stock';
import type { Page, PageInput } from '../../../../../../shared/contracts/business';
import { commandError } from './command-error';
const names = {
  SUBMIT: 'submitRequest',
  APPROVE: 'approveRequest',
  REJECT: 'rejectRequest',
  DISPATCH: 'dispatchTransfer',
  RECEIVE: 'receiveTransfer',
};
const policy = { fetchPolicy: QueryFetchPolicy.SERVER_ONLY };
function summary(
  r: NonNullable<sdk.ListHqQueueData['membership']>['business']['requests'][number],
): RequestSummary {
  return {
    ...r,
    state: r.state as RequestState,
    productName: r.product.name,
    salonName: r.salon.name,
  };
}
@Service()
export class ReplenishmentApi {
  private readonly firebase = inject(FIREBASE);
  private readonly inventory = inject(InventoryApi);
  async runAction(action: StockAction): Promise<CommandResult> {
    try {
      return (
        await httpsCallable<StockAction['input'], CommandResult>(
          this.firebase.functions,
          names[action.type],
        )(action.input)
      ).data;
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
    return data.membership?.business.requests.map(summary) ?? [];
  }
  async listHQQueue(page: PageInput): Promise<Page<RequestSummary>> {
    const { data } = await sdk.listHqQueue(this.firebase.data, page, policy);
    const items = data.membership?.business.requests.map(summary) ?? [];
    return { items, nextOffset: items.length === page.limit ? page.offset + page.limit : null };
  }
  async getRequest(requestId: string): Promise<RequestDetail> {
    const { data } = await sdk.getRequestDetail(this.firebase.data, { requestId }, policy);
    const r = data.membership?.business.requests[0];
    if (!r) throw new Error('Request unavailable.');
    const stock = (await this.inventory.getInventory(r.salonId)).find(
      (row) => row.productId === r.productId,
    );
    if (!stock) throw new Error('Inventory unavailable.');
    return {
      ...summary(r),
      stock,
      hqInventoryVersion: stock.hqInventoryVersion,
      dispatchedQuantity: r.transfer?.dispatchedQuantity ?? 0,
      receivedQuantity: r.transfer?.receivedQuantity ?? 0,
      timeline: r.timeline.map((t) => ({
        state: t.state as RequestState,
        at: t.createdAt,
        actorLabel: t.action === 'SUBMIT' || t.action === 'RECEIVE' ? 'Salon' : 'HQ',
        ...(t.reason ? { reason: t.reason } : {}),
      })),
    };
  }
}
