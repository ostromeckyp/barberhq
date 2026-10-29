export function deliveryProcedureQuestion(problem: string | null): string | null {
  switch (problem) {
    case 'DAMAGED':
      return 'W dostawie są uszkodzone produkty. Jak postąpić zgodnie z procedurą?';
    case 'MISSING':
      return 'W dostawie brakuje produktów. Jak postąpić zgodnie z procedurą?';
    case 'BOTH':
      return 'W dostawie są uszkodzone produkty i brakuje części produktów. Jak postąpić zgodnie z procedurą?';
    default:
      return null;
  }
}
