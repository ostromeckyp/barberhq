export type PrepareInput = {
  salonId: string;
  message: string;
  /** UI language for AI-written text such as match reasons; defaults to English. */
  language?: 'pl' | 'en';
  clarifications?: {
    lineId: string;
    originalWording: string;
    productId?: string;
    quantity?: number;
    /** Opaque server receipt from the clarification; never a trusted product phrase. */
    choiceReceiptId?: string;
  }[];
};
