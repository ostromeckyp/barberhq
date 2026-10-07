import { Service, InjectionToken, inject } from '@angular/core';
import type { PendingSubmission } from '../../../../../../shared/contracts/draft';
export const PENDING_STORAGE = new InjectionToken<Storage>('Pending submission storage', {
  providedIn: 'root',
  factory: () => sessionStorage,
});
const KEY = 'barberhq.pending.v2',
  LEGACY = 'barberhq.pending.v1';
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (v: Record<string, unknown>, expected: string[]) =>
  Object.keys(v).length === expected.length && expected.every((k) => Object.hasOwn(v, k));
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 300;
export function validPending(v: unknown): v is PendingSubmission {
  if (
    !record(v) ||
    !keys(v, ['version', 'userId', 'businessId', 'salonId', 'payload']) ||
    v['version'] !== 2 ||
    ![v['userId'], v['businessId'], v['salonId']].every(id)
  )
    return false;
  const p = v['payload'];
  if (
    !record(p) ||
    !keys(p, ['salonId', 'items', 'idempotencyKey']) ||
    p['salonId'] !== v['salonId'] ||
    typeof p['idempotencyKey'] !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      p['idempotencyKey'],
    )
  )
    return false;
  const items = p['items'];
  return (
    Array.isArray(items) &&
    items.length >= 1 &&
    items.length <= 6 &&
    items.every(
      (i) =>
        record(i) &&
        keys(i, ['productId', 'quantity']) &&
        id(i['productId']) &&
        typeof i['quantity'] === 'number' &&
        Number.isInteger(i['quantity']) &&
        i['quantity'] >= 1 &&
        i['quantity'] <= 99,
    ) &&
    new Set(items.map((i) => i.productId)).size === items.length
  );
}
export type PendingState =
  | { kind: 'EMPTY' }
  | { kind: 'PENDING'; value: PendingSubmission }
  | { kind: 'BLOCKED'; reason: 'LEGACY' | 'INVALID' | 'STORAGE_UNAVAILABLE' };
@Service()
export class PendingSubmissionStore {
  private readonly storage = inject(PENDING_STORAGE);
  load(): PendingState {
    let raw: string | null;
    try {
      if (this.storage.getItem(LEGACY) !== null) return { kind: 'BLOCKED', reason: 'LEGACY' };
      raw = this.storage.getItem(KEY);
    } catch {
      return { kind: 'BLOCKED', reason: 'STORAGE_UNAVAILABLE' };
    }
    if (raw === null) return { kind: 'EMPTY' };
    try {
      const value: unknown = JSON.parse(raw);
      return validPending(value)
        ? { kind: 'PENDING', value }
        : { kind: 'BLOCKED', reason: 'INVALID' };
    } catch {
      return { kind: 'BLOCKED', reason: 'INVALID' };
    }
  }
  save(value: PendingSubmission): void {
    if (!validPending(value)) throw Error('Invalid pending submission.');
    if (this.load().kind === 'BLOCKED') throw Error('Reconcile saved state before submitting.');
    this.storage.setItem(KEY, JSON.stringify(value));
  }
  clearPending(): void {
    const raw = this.storage.getItem(KEY);
    if (raw === null) return;
    const value: unknown = JSON.parse(raw);
    if (!validPending(value)) throw Error('Unrecognized pending state must be preserved.');
    this.storage.removeItem(KEY);
  }
}
