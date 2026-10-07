export class CommandError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly requestId?: string,
  ) {
    super(message);
  }
}
export function commandError(error: unknown): CommandError {
  const e = error as { details?: { code?: string; requestId?: string }; message?: string };
  return new CommandError(
    e?.details?.code ?? 'UNKNOWN',
    e?.details?.code
      ? (e.message ?? e.details.code)
      : 'Outcome unknown. Reconcile before continuing.',
    e?.details?.requestId,
  );
}
