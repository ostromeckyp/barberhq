import { describe, expect, it } from 'vitest';
import type { GetSalonInventoryData } from '../../../core/generated';
import { mapInventory } from './inventory.mapper';
function business(): NonNullable<GetSalonInventoryData['membership']>['business'] {
  return {
    salon: [
      {
        id: 'salon-1',
        name: 'Legnicka',
        inventory: [
          {
            onHand: 2,
            reserved: 0,
            version: 1,
            product: { id: 'p1', demoId: 'pomada', name: 'Pomada', netContentMl: 100 },
          },
        ],
      },
    ],
    hq: [{ inventory: [{ productId: 'p1', onHand: 18, reserved: 3, version: 2 }] }],
  };
}
describe('mapInventory', () => {
  it('maps actual quantities and subtracts reserved HQ stock', () => {
    expect(mapInventory('salon-1', business())[0]).toMatchObject({
      salonId: 'salon-1',
      salonOnHand: 2,
      hqAvailable: 15,
      hqInventoryVersion: 2,
      netContent: { value: 100, unit: 'ml' },
    });
  });
  it('rejects missing access or HQ records instead of inventing stock', () => {
    expect(() => mapInventory('salon-1', undefined)).toThrow('Inventory is not available.');
    const missing = business();
    missing.hq[0].inventory = [];
    expect(() => mapInventory('salon-1', missing)).toThrow('HQ inventory is incomplete.');
  });
});
