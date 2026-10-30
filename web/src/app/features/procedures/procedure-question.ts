/** Translation key of the assistant question suggested for a delivery problem. */
export function deliveryProcedureQuestion(problem: string | null): string | null {
  switch (problem) {
    case 'DAMAGED':
      return 'procedures.assistant.examples.deliveryDamaged';
    case 'MISSING':
      return 'procedures.assistant.examples.deliveryMissing';
    case 'BOTH':
      return 'procedures.assistant.examples.deliveryBoth';
    default:
      return null;
  }
}
