import type * as sdk from '../../../core/generated';
import type {
  DeliveryIssueDto,
  DeliveryIssueSummaryDto,
  DeliveryReceiptDto,
  DeliverySummaryDto,
  DeliveryQuantities,
  DeliveryProcedureDto,
} from '../../../../../../shared/contracts/delivery/index';
import { deliveryQuantities } from '../../../../../../shared/delivery-quantities';
type ReceiptRecord = NonNullable<
  NonNullable<sdk.GetDeliveryReceiptData['membership']>['business']['requests'][number]['receipt']
>;
type IssueRecord = NonNullable<
  sdk.GetDeliveryIssueData['membership']
>['business']['issues'][number];
type Head = { id: string; status: DeliveryIssueDto['status']; revision: number };
export function toDeliveryReceipt(row: ReceiptRecord): DeliveryReceiptDto {
  return {
    id: row.id,
    requestId: row.requestId,
    recordedAt: row.recordedAt,
    actorLabel: 'Recipient',
    origin: row.origin,
    legacyActionReceiptId: row.legacyActionReceiptId ?? null,
    items: row.items.map((item) => ({
      productId: item.productId,
      productName: item.product.name,
      goodQuantity: item.goodQuantity,
      damagedQuantity: item.damagedQuantity,
      missingQuantity: item.missingQuantity,
    })),
    report: row.description
      ? { description: row.description, batchIdentifier: row.batchIdentifier ?? null }
      : null,
    procedureReferences: row.procedureReferences.map((ref) => ({
      kind: ref.kind,
      versionId: ref.versionId,
      ...(ref.chunkId ? { chunkId: ref.chunkId } : {}),
    })),
    rootIssueId: row.rootIssueId ?? null,
  };
}
export function toDeliverySummary(
  row: {
    receipt?: ReceiptRecord | null;
    replacementIssue?: Head | null;
    replacementIssueId?: string | null;
  },
  items: { productId: string; dispatchedQuantity: number; receivedQuantity: number }[],
): DeliverySummaryDto {
  const receipt = row.receipt ? toDeliveryReceipt(row.receipt) : null,
    root = row.replacementIssue ?? row.receipt?.rootIssue;
  if (
    receipt &&
    (receipt.items.length !== items.length ||
      new Set(receipt.items.map((item) => item.productId)).size !== items.length ||
      items.some((item) => !receipt.items.some((line) => line.productId === item.productId)))
  )
    throw new Error('Delivery inspection unavailable.');
  return {
    receipt,
    rootIssue: root ? { id: root.id, status: root.status, revision: root.revision } : null,
    replacementForIssueId: row.replacementIssueId ?? null,
    items: items.map((item) => ({
      productId: item.productId,
      ...deliveryQuantities({
        ...item,
        receiptItem: receipt?.items.find((line) => line.productId === item.productId) ?? null,
      }),
    })),
  };
}
function issueItems(items: IssueRecord['items']) {
  return items.map((item) => {
    if (
      !Number.isInteger(item.initialAffectedQuantity) ||
      !Number.isInteger(item.replacementAcceptedQuantity) ||
      item.replacementAcceptedQuantity < 0 ||
      item.replacementAcceptedQuantity > item.initialAffectedQuantity
    )
      throw new Error('Delivery quantities are unavailable.');
    return {
      productId: item.productId,
      productName: item.product.name,
      initialAffectedQuantity: item.initialAffectedQuantity,
      replacementAcceptedQuantity: item.replacementAcceptedQuantity,
      outstandingQuantity: item.initialAffectedQuantity - item.replacementAcceptedQuantity,
    };
  });
}
export function toDeliveryIssueSummary(
  row: Pick<
    IssueRecord,
    | 'id'
    | 'rootRequestId'
    | 'salonId'
    | 'status'
    | 'revision'
    | 'createdAt'
    | 'salon'
    | 'items'
    | 'activeReplacement'
  >,
): DeliveryIssueSummaryDto {
  return {
    id: row.id,
    rootRequestId: row.rootRequestId,
    salonId: row.salonId,
    salonName: row.salon.name,
    status: row.status,
    revision: row.revision,
    createdAt: row.createdAt,
    outstandingQuantity: issueItems(row.items).reduce(
      (sum, item) => sum + item.outstandingQuantity,
      0,
    ),
    activeReplacement: row.activeReplacement
      ? {
          id: row.activeReplacement.id,
          state: row.activeReplacement.state,
          createdAt: row.activeReplacement.createdAt,
        }
      : null,
  };
}
function eventQuantities(value: unknown): DeliveryQuantities[] {
  if (
    !Array.isArray(value) ||
    value.length > 6 ||
    value.some(
      (item) =>
        !item ||
        typeof item.productId !== 'string' ||
        [item.goodQuantity, item.damagedQuantity, item.missingQuantity].some(
          (quantity) => !Number.isInteger(quantity) || quantity < 0 || quantity > 99,
        ),
    )
  )
    throw new Error('Delivery history is unavailable.');
  return value.map((item) => ({
    productId: item.productId,
    goodQuantity: item.goodQuantity,
    damagedQuantity: item.damagedQuantity,
    missingQuantity: item.missingQuantity,
  }));
}
export function toDeliveryIssue(
  row: IssueRecord,
  eventOffset: number,
  replacementOffset: number,
  limit: number,
): DeliveryIssueDto {
  const summary = toDeliveryIssueSummary(row);
  return {
    id: summary.id,
    rootRequestId: row.rootRequestId,
    rootReceipt: toDeliveryReceipt(row.rootReceipt),
    salonId: summary.salonId,
    salonName: summary.salonName,
    status: summary.status,
    revision: summary.revision,
    createdAt: summary.createdAt,
    items: issueItems(row.items),
    activeReplacement: summary.activeReplacement,
    replacements: row.replacements.map((request) => ({
      id: request.id,
      state: request.state,
      createdAt: request.createdAt,
    })),
    replacementOffset,
    hasMoreReplacements: row.replacements.length === limit,
    events: row.events.map((event) => ({
      id: event.id,
      revision: event.revision,
      type: event.type,
      recordedAt: event.recordedAt,
      actorLabel:
        event.type === 'OPENED' || event.type === 'REPLACEMENT_RECEIVED' ? 'Recipient' : 'HQ',
      requestId: event.requestId ?? null,
      note: event.note ?? null,
      status: event.status,
      quantities: eventQuantities(event.quantities),
    })),
    eventOffset,
    hasMoreEvents: row.events.length === limit,
  };
}
export function toProcedureBindings(
  data: sdk.GetDeliveryProcedureBindingsData,
): DeliveryProcedureDto[] {
  const member = data.membership;
  if (!member) throw new Error('Delivery procedures unavailable.');
  return (['DAMAGED', 'MISSING'] as const).map((kind): DeliveryProcedureDto => {
    const row = member.business.bindings.find((binding) => binding.kind === kind),
      document = row?.document;
    const base = { kind, documentId: row?.documentId ?? null, revision: row?.revision ?? 0 };
    if (!row?.documentId) return { ...base, availability: 'MISSING', reference: null, title: null };
    const current = document?.versions.find(
      (version) =>
        version.id === document.activeVersionId &&
        version.businessId === member.businessId &&
        version.status === 'READY' &&
        version.publishedAt &&
        !version.revokedAt,
    );
    if (document?.businessId !== member.businessId || !current)
      return { ...base, availability: 'UNAVAILABLE', reference: null, title: null };
    return {
      ...base,
      availability: 'AVAILABLE',
      reference: { kind, versionId: current.id },
      title: current.title,
    };
  });
}
