export type PrepareInput = {
  salonId: string;
  message: string;
  clarifications?: {
    lineId: string;
    originalWording: string;
    productId?: string;
    quantity?: number;
    /** Opaque server receipt from the clarification; never a trusted product phrase. */
    choiceReceiptId?: string;
  }[];
};
