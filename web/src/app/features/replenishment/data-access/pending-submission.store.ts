import { Service, InjectionToken, inject } from '@angular/core';
import type { PendingSubmission } from '../../../../../../shared/contracts/draft';
export const PENDING_STORAGE = new InjectionToken<Storage>('Pending submission storage', {
  providedIn: 'root',
  factory: () => sessionStorage,
});
const KEY = 'barberhq.pending.v1';
export function validPending(value: unknown): value is PendingSubmission {
  if (!value || typeof value !== 'object') return false;
  const p = value as PendingSubmission;
  if (
    ![p.userId, p.businessId, p.salonId].every(
      (x) => typeof x === 'string' && x.length > 0 && x.length <= 300,
    ) ||
    !Array.isArray(p.rows) ||
    p.rows.length > 6
  )
    return false;
  const keys = new Set<string>(),
    products = new Set<string>();
  return p.rows.every((r) => {
    const a = r?.payload;
    if (
      !a ||
      !['UNSENT', 'UNKNOWN'].includes(r.status) ||
      typeof r.lineId !== 'string' ||
      r.lineId.length > 300 ||
      a.salonId !== p.salonId ||
      typeof a.productId !== 'string' ||
      !a.productId ||
      a.productId.length > 300 ||
      !Number.isInteger(a.quantity) ||
      a.quantity < 1 ||
      a.quantity > 99 ||
      typeof a.idempotencyKey !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        a.idempotencyKey,
      ) ||
      keys.has(a.idempotencyKey) ||
      products.has(a.productId)
    )
      return false;
    keys.add(a.idempotencyKey);
    products.add(a.productId);
    return true;
  });
}
@Service()
export class PendingSubmissionStore {
  private readonly storage = inject(PENDING_STORAGE);
  load(): PendingSubmission | undefined {
    try {
      const raw = this.storage.getItem(KEY);
      if (!raw) return;
      const data: unknown = JSON.parse(raw);
      if (validPending(data)) return data;
      this.clear();
    } catch {
      this.clear();
    }
    return undefined;
  }
  save(value: PendingSubmission) {
    if (!validPending(value)) throw new Error('Invalid pending submission.');
    this.storage.setItem(KEY, JSON.stringify(value));
  }
  clear() {
    try {
      this.storage.removeItem(KEY);
    } catch {
      // Storage can be disabled by the browser. Saving still fails closed before any write.
    }
  }
}
