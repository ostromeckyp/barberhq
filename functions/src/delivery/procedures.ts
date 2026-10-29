import type { DataConnect } from 'firebase-admin/data-connect';
import type {
  DeliveryProblemKind,
  DeliveryProcedureDto,
} from '../../../shared/contracts/delivery/index.js';
import * as sql from '@barberhq/server';
import { authorizeDeliveryContext } from './access.js';
import { StockError } from '../stock/errors.js';
export async function resolveDeliveryProcedures(
  dc: DataConnect,
  uid: string,
  requestId: string,
  kinds: DeliveryProblemKind[],
): Promise<DeliveryProcedureDto[]> {
  if (!uid) throw new StockError('UNAUTHENTICATED');
  const { member } = authorizeDeliveryContext(
    (await sql.readDeliveryContext(dc, { uid, requestId })).data,
  );
  const data = (await sql.readDeliveryBindings(dc, { uid })).data;
  if (data.membership?.businessId !== member.businessId) throw new StockError('FORBIDDEN');
  return [...new Set(kinds)].map((kind): DeliveryProcedureDto => {
    const binding = data.membership!.business.bindings.find((row) => row.kind === kind);
    const base = {
      kind,
      documentId: binding?.documentId ?? null,
      revision: binding?.revision ?? 0,
    };
    if (!binding?.documentId)
      return { ...base, availability: 'MISSING', reference: null, title: null };
    const document = binding.document;
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
