/** Display and learning metadata for a READY line whose product the AI chose; submit ignores it. */
export type AiMatch = {
  originalWording: string;
  /** Short model explanation in the UI language (at most 120 characters). */
  reason: string;
  /** Other products the user may switch to, in offer order. */
  alternatives: { productId: string; productName: string }[];
  /** Server receipt that lets the user's change teach salon shorthand. */
  choiceReceiptId?: string;
};
