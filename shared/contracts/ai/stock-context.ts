export type StockContext = {
  productId: string;
  productName: string;
  hqAvailable: number;
  salonOnHand: number;
  hqInventoryVersion: number;
  salonInventoryVersion: number;
  activeRequestId: string | null;
};
