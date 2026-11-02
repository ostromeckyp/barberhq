import { Service, inject } from '@angular/core';
import { QueryFetchPolicy } from 'firebase/data-connect';
import { callFunction } from '../../../core/call-function';
import { FIREBASE } from '../../../core/firebase.providers';
import { listHqShorthand, listSalonShorthand } from '../../../core/generated';
import type { SalonShorthand } from '../../../../../../shared/contracts/product-lookup/index';
export type ShorthandPage = { rows: SalonShorthand[]; nextCursor: string | null };
export type RemoveShorthandInput = {
  salonId: string;
  aliasId: string;
  expectedRevision: number;
  idempotencyKey: string;
};
export class ShorthandRemoveError extends Error {
  constructor(readonly code: 'STALE_STATE' | 'FORBIDDEN' | 'VALIDATION_ERROR' | 'UNKNOWN') {
    super(code);
  }
}
type Row = {
  id: string;
  businessId: string;
  phrase: string;
  revision: number;
  reviewedAt?: string | null;
  createdAt: string;
  salon?: { id: string; name: string; businessId: string } | null;
  product: { id: string; name: string; businessId: string };
};
const pageSize = 50;
/** Only ACTIVE salon-confirmed rows whose salon and product share the row's business. */
function page(rows: Row[]): ShorthandPage {
  return {
    rows: rows
      .filter(
        (r) =>
          r.salon && r.salon.businessId === r.businessId && r.product.businessId === r.businessId,
      )
      .map((r) => ({
        id: r.id,
        salonId: r.salon!.id,
        salonName: r.salon!.name,
        productId: r.product.id,
        productName: r.product.name,
        phrase: r.phrase,
        revision: r.revision,
        status: 'active' as const,
        updatedAt: r.reviewedAt ?? r.createdAt,
      })),
    nextCursor: rows.length === pageSize ? rows[rows.length - 1].id : null,
  };
}
@Service()
export class SalonShorthandApi {
  private readonly firebase = inject(FIREBASE);
  async list(salonId: string, after = ''): Promise<ShorthandPage> {
    const data = (
      await listSalonShorthand(
        this.firebase.data,
        { salonId, after },
        { fetchPolicy: QueryFetchPolicy.SERVER_ONLY },
      )
    ).data;
    return page(data.productAliases as Row[]);
  }
  async listHq(businessId: string, after = ''): Promise<ShorthandPage> {
    const data = (
      await listHqShorthand(
        this.firebase.data,
        { businessId, after },
        { fetchPolicy: QueryFetchPolicy.SERVER_ONLY },
      )
    ).data;
    return page(data.productAliases as Row[]);
  }
  async remove(input: RemoveShorthandInput): Promise<SalonShorthand> {
    try {
      const row = await callFunction<RemoveShorthandInput, SalonShorthand>(
        this.firebase,
        'removeSalonShorthand',
        input,
      );
      if (row?.id !== input.aliasId || row.status !== 'retired') throw Error('UNKNOWN');
      return row;
    } catch (error) {
      const code = (error as { code?: string })?.code;
      throw new ShorthandRemoveError(
        code === 'functions/aborted'
          ? 'STALE_STATE'
          : code === 'functions/permission-denied'
            ? 'FORBIDDEN'
            : code === 'functions/invalid-argument'
              ? 'VALIDATION_ERROR'
              : 'UNKNOWN',
      );
    }
  }
}
