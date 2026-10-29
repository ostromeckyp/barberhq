import { inject, InjectionToken } from '@angular/core';
import type { DeliveryAction } from '../../../../../../shared/contracts/delivery';
export type DeliveryScope = {
  userId: string;
  businessId: string;
  salonId: string;
  targetId: string;
};
export type JournalStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
};
export const DELIVERY_STORAGE = new InjectionToken<JournalStorage>('Delivery recovery storage', {
  factory: () => ({
    getItem: (key) => globalThis.localStorage.getItem(key),
    setItem: (key, value) => globalThis.localStorage.setItem(key, value),
    removeItem: (key) => globalThis.localStorage.removeItem(key),
    keys: () => Object.keys(globalThis.localStorage),
  }),
});
export const scopeKey = (scope: DeliveryScope) =>
  JSON.stringify([scope.userId, scope.businessId, scope.salonId, scope.targetId]);
const prefix = 'barberhq.delivery.v1.';
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function validAction(value: unknown): value is DeliveryAction {
  if (!value || typeof value !== 'object') return false;
  const a = value as DeliveryAction,
    i = a.input;
  if (
    !i ||
    !Number.isInteger(i.expectedRevision) ||
    i.expectedRevision < 0 ||
    typeof i.idempotencyKey !== 'string' ||
    !i.idempotencyKey ||
    i.idempotencyKey.length > 300
  )
    return false;
  if (a.type === 'RECORD_RECEIPT')
    return (
      typeof a.input.requestId === 'string' &&
      Array.isArray(a.input.items) &&
      a.input.items.length > 0 &&
      a.input.items.length <= 6 &&
      a.input.items.every(
        (row) =>
          typeof row.productId === 'string' &&
          [row.goodQuantity, row.damagedQuantity, row.missingQuantity].every(
            (q) => Number.isInteger(q) && q >= 0 && q <= 99,
          ),
      ) &&
      Array.isArray(a.input.procedureReferences) &&
      a.input.procedureReferences.length <= 2 &&
      new Set(a.input.procedureReferences.map((ref) => ref?.kind)).size ===
        a.input.procedureReferences.length &&
      a.input.procedureReferences.every(
        (ref) =>
          ref &&
          ['DAMAGED', 'MISSING'].includes(ref.kind) &&
          typeof ref.versionId === 'string' &&
          ref.versionId.length > 0 &&
          ref.versionId.length <= 300 &&
          (ref.chunkId === undefined ||
            (typeof ref.chunkId === 'string' &&
              ref.chunkId.length > 0 &&
              ref.chunkId.length <= 300)),
      ) &&
      (a.input.report === undefined ||
        (a.input.report &&
          typeof a.input.report.description === 'string' &&
          a.input.report.description.trim().length > 0 &&
          a.input.report.description.length <= 1000 &&
          (a.input.report.batchIdentifier === null ||
            (typeof a.input.report.batchIdentifier === 'string' &&
              a.input.report.batchIdentifier.length <= 120))))
    );
  if (a.type === 'SET_PROCEDURE')
    return (
      ['DAMAGED', 'MISSING'].includes(a.input.kind) &&
      (a.input.documentId === null || typeof a.input.documentId === 'string')
    );
  if (a.type === 'ADD_NOTE')
    return typeof a.input.issueId === 'string' && typeof a.input.text === 'string';
  return (
    (a.type === 'START_REVIEW' || a.type === 'CREATE_REPLACEMENT') &&
    typeof a.input.issueId === 'string'
  );
}
function target(action: DeliveryAction) {
  return action.type === 'RECORD_RECEIPT'
    ? action.input.requestId
    : action.type === 'SET_PROCEDURE'
      ? action.input.kind
      : action.input.issueId;
}
export class DeliveryJournal {
  constructor(private readonly storage: JournalStorage) {}
  private key(scope: DeliveryScope) {
    return prefix + encodeURIComponent(scopeKey(scope));
  }
  load(scope: DeliveryScope): DeliveryAction | null {
    const raw = this.storage.getItem(this.key(scope));
    if (raw === null) return null;
    try {
      if (raw.length > 50000) throw new Error();
      const row = JSON.parse(raw);
      if (
        row.version !== 1 ||
        scopeKey(row.scope) !== scopeKey(scope) ||
        !validAction(row.action) ||
        target(row.action) !== scope.targetId
      )
        throw new Error();
      return freeze(row.action);
    } catch {
      throw new Error(
        'The saved inspection cannot be read. Keep this browser data and contact HQ.',
      );
    }
  }
  save(scope: DeliveryScope, action: DeliveryAction): void {
    if (!validAction(action) || target(action) !== scope.targetId)
      throw new Error('Invalid recovery command.');
    const previous = this.load(scope);
    if (previous && JSON.stringify(previous) !== JSON.stringify(action))
      throw new Error('Reconcile the saved command before editing.');
    this.storage.setItem(this.key(scope), JSON.stringify({ version: 1, scope, action }));
    if (!this.load(scope)) throw new Error('Could not save recovery data.');
  }
  clear(scope: DeliveryScope): void {
    this.storage.removeItem(this.key(scope));
  }
  clearUser(uid: string): void {
    for (const key of this.storage.keys()) {
      if (!key.startsWith(prefix)) continue;
      try {
        const scope = JSON.parse(decodeURIComponent(key.slice(prefix.length)));
        if (Array.isArray(scope) && scope[0] === uid) this.storage.removeItem(key);
      } catch {
        /* Preserve unrecognized recovery entries. */
      }
    }
  }
}

export const DELIVERY_JOURNAL = new InjectionToken<DeliveryJournal>('Delivery command journal', {
  factory: () => new DeliveryJournal(inject(DELIVERY_STORAGE)),
});
