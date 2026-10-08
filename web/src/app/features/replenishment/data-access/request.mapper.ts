import type * as sdk from '../../../core/generated';
import type { InventoryRow } from '../../../../../../shared/contracts/business';
import type {
  RequestSummary,
  RequestDetail,
  RequestState,
} from '../../../../../../shared/contracts/stock';
type SummaryRecord = NonNullable<sdk.ListHqQueueData['membership']>['business']['requests'][number];
type DetailRecord = NonNullable<
  sdk.GetRequestDetailData['membership']
>['business']['requests'][number];
export function toRequestSummary(r: SummaryRecord): RequestSummary {
  return {
    id: r.id,
    salonId: r.salonId,
    salonName: r.salon.name,
    state: r.state as RequestState,
    revision: r.revision,
    createdAt: r.createdAt,
    items: r.items.map((i) => ({
      productId: i.productId,
      productName: i.product.name,
      quantity: i.quantity,
    })),
    itemCount: r.items.length,
    totalUnits: r.items.reduce((sum, i) => sum + i.quantity, 0),
  };
}
export function toRequestDetail(r: DetailRecord, inventory: InventoryRow[]): RequestDetail {
  return {
    ...toRequestSummary(r),
    items: r.items.map((i) => {
      const stock = inventory.find(
        (row) => row.productId === i.productId && row.salonId === r.salonId,
      );
      if (!stock) throw new Error('Inventory unavailable.');
      return {
        productId: i.productId,
        productName: i.product.name,
        quantity: i.quantity,
        dispatchedQuantity: i.transferItem?.dispatchedQuantity ?? 0,
        receivedQuantity: i.transferItem?.receivedQuantity ?? 0,
        stock,
      };
    }),
    timeline: r.timeline.map((t) => ({
      state: t.state as RequestState,
      at: t.createdAt,
      actorLabel: t.action === 'SUBMIT' ? 'Requester' : t.action === 'RECEIVE' ? 'Salon' : 'HQ',
      ...(t.reason ? { reason: t.reason } : {}),
    })),
  };
}
