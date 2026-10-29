import { describe, it, expect } from 'vitest';
import { DeliveryJournal, type JournalStorage } from './delivery-journal';
import type { DeliveryScope } from '../models/delivery-scope';
const scope: DeliveryScope = {
  userId: 'one',
  businessId: 'business',
  salonId: 'salon',
  targetId: 'request',
};
const action = {
  type: 'RECORD_RECEIPT' as const,
  input: {
    requestId: 'request',
    expectedRevision: 3,
    idempotencyKey: 'original-key',
    items: [{ productId: 'product', goodQuantity: 8, damagedQuantity: 2, missingQuantity: 0 }],
    report: { description: 'Cracked', batchIdentifier: 'LOT-42' },
    procedureReferences: [],
  },
};
function setup() {
  const data = new Map<string, string>();
  const storage: JournalStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
    keys: () => [...data.keys()],
  };
  return { data, storage, journal: new DeliveryJournal(storage) };
}
describe('DeliveryJournal', () => {
  it('recovers an immutable exact submitted command after reload only in the original scope', () => {
    const { storage, journal } = setup();
    journal.save(scope, action);
    const recovered = new DeliveryJournal(storage).load(scope)!;
    expect(recovered).toEqual(action);
    expect(Object.isFrozen(recovered.type === 'RECORD_RECEIPT' && recovered.input.items[0])).toBe(
      true,
    );
    expect(journal.load({ ...scope, userId: 'two' })).toBeNull();
    expect(journal.load({ ...scope, salonId: 'other' })).toBeNull();
    expect(journal.load({ ...scope, businessId: 'other' })).toBeNull();
  });
  it('refuses to replace an unresolved command with a new key or payload', () => {
    const { journal } = setup();
    journal.save(scope, action);
    expect(() =>
      journal.save(scope, { ...action, input: { ...action.input, idempotencyKey: 'new-key' } }),
    ).toThrow();
    expect(journal.load(scope)).toEqual(action);
  });
  it('preserves an unrecognized record instead of rewriting or deleting it', () => {
    const { data, journal } = setup();
    journal.save(scope, action);
    const key = [...data.keys()][0];
    data.set(key, '{"version":9,"opaque":"retained"}');
    expect(() => journal.load(scope)).toThrow(/saved/i);
    expect(data.get(key)).toContain('retained');
  });
  it('explicit sign-out clears this user namespace only', () => {
    const { data, journal } = setup();
    journal.save(scope, action);
    journal.save({ ...scope, userId: 'two' }, action);
    data.set('legacy-stock-key', 'keep');
    journal.clearUser('one');
    expect(journal.load(scope)).toBeNull();
    expect(journal.load({ ...scope, userId: 'two' })).toEqual(action);
    expect(data.get('legacy-stock-key')).toBe('keep');
  });
  it('does not post a command if durable recovery cannot be saved', () => {
    const { storage } = setup();
    storage.setItem = () => {
      throw new Error('Storage blocked');
    };
    expect(() => new DeliveryJournal(storage).save(scope, action)).toThrow('Storage blocked');
  });
});

it('blocks a malformed version-one report or source without rewriting the saved command', () => {
  const data = new Map<string, string>(),
    storage: JournalStorage = {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => {
        data.set(k, v);
      },
      removeItem: (k) => {
        data.delete(k);
      },
      keys: () => [...data.keys()],
    };
  const journal = new DeliveryJournal(storage);
  journal.save(scope, action);
  const key = [...data.keys()][0],
    valid = data.get(key)!;
  for (const patch of [
    { report: { description: 42, batchIdentifier: null } },
    { procedureReferences: [{ kind: 'DAMAGED', versionId: 42 }] },
  ]) {
    const row = JSON.parse(valid);
    Object.assign(row.action.input, patch);
    const raw = JSON.stringify(row);
    data.set(key, raw);
    expect(() => journal.load(scope)).toThrow(/saved/i);
    expect(data.get(key)).toBe(raw);
  }
});
