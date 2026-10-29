export type Confirmation = {
  reason: string;
  items: { productId: string; receivedQuantity: number }[];
  allIntact: boolean;
};
