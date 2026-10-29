export interface InventoryRow {
  productId: string;
  demoId: string;
  productName: string;
  netContent: { value: number; unit: 'ml' };
  salonId: string;
  salonOnHand: number;
  salonInventoryVersion: number;
  hqOnHand: number;
  hqReserved: number;
  hqAvailable: number;
  hqInventoryVersion: number;
}
/** Seed-only product knowledge: the assistant learns these phrases from data, never from code. */
