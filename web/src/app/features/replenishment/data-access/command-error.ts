import type { ActiveConflict } from '../../../../../../shared/contracts/stock/index';
export class CommandError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly conflicts?: ActiveConflict[],
  ) {
    super(message);
  }
}
export function commandError(error: unknown): CommandError {
  const e = error as {
    details?: { code?: string; conflicts?: ActiveConflict[] };
    message?: string;
  };
  return new CommandError(
    e?.details?.code ?? 'UNKNOWN',
    e?.details?.code === 'CLIENT_UPDATE_REQUIRED'
      ? 'Reload the app to inspect this delivery.'
      : e?.details?.code
        ? (e.message ?? e.details.code)
        : 'Outcome unknown. Reconcile before continuing.',
    e?.details?.conflicts,
  );
}
