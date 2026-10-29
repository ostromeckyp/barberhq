import type * as sdk from '../../../core/generated';
import type { InventoryRow } from '../../../../../../shared/contracts/business';
import type {
  RequestSummary,
  RequestDetail,
  RequestState,
} from '../../../../../../shared/contracts/stock';
import { toDeliverySummary } from '../../delivery/data-access/delivery.mapper';
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
  if (r.state === 'RECEIVED_WITH_ISSUE' && !r.receipt)
    throw new Error('Delivery inspection unavailable.');
  const items = r.items.map((i) => {
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
  });
  const delivery = toDeliverySummary(r, items);
  const timeline = r.timeline.map((t) => ({
    revision: t.revision,
    state: t.state as RequestState,
    at: t.createdAt,
    actorLabel: t.action === 'SUBMIT' ? 'Requester' : t.action === 'RECEIVE' ? 'Recipient' : 'HQ',
    ...(t.reason ? { reason: t.reason } : {}),
  }));
  if (r.replacementCreation[0] && !r.timeline.some((event) => event.action === 'SUBMIT'))
    timeline.push({
      revision: 1,
      state: 'PENDING_APPROVAL',
      at: r.replacementCreation[0].recordedAt,
      actorLabel: 'HQ',
    });
  if (
    r.receipt &&
    !r.timeline.some(
      (event) => event.action === 'RECEIVE' && event.id === r.receipt?.legacyActionReceiptId,
    )
  )
    timeline.push({
      revision: r.revision,
      state: r.receipt.items.some((item) => item.damagedQuantity + item.missingQuantity > 0)
        ? 'RECEIVED_WITH_ISSUE'
        : 'RECEIVED',
      at: r.receipt.recordedAt,
      actorLabel: 'Recipient',
    });
  return {
    ...toRequestSummary(r),
    delivery,
    items: items.map((item) => {
      const { productId, ...quantities } = delivery.items.find(
        (line) => line.productId === item.productId,
      )!;
      return { ...item, receivedQuantity: quantities.goodQuantity, delivery: quantities };
    }),
    timeline: timeline
      .sort((a, b) => a.revision - b.revision)
      .map(({ revision, ...event }) => event),
  };
}
