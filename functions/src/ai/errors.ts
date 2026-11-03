import { HttpsError } from 'firebase-functions/v2/https';
import { AiError } from './budget.js';

/** Public callable error mapping shared by every AI endpoint; provider details never leak. */
export function publicAiError(error: unknown): never {
  if (error instanceof HttpsError) throw error;
  if (error instanceof AiError) {
    const code =
      error.code === 'UNAUTHENTICATED'
        ? 'unauthenticated'
        : error.code === 'FORBIDDEN'
          ? 'permission-denied'
          : error.code === 'VALIDATION_ERROR'
            ? 'invalid-argument'
            : error.code === 'RATE_LIMITED' ||
                error.code === 'MODEL_LIMIT' ||
                error.code === 'TOOL_LIMIT'
              ? 'resource-exhausted'
              : error.code === 'TIMEOUT'
                ? 'deadline-exceeded'
                : error.code === 'SOURCE_CHANGED'
                  ? 'aborted'
                  : error.code === 'INVALID_CONFIG' ||
                      error.code === 'EMBEDDING_CONFIG_MISMATCH' ||
                      error.code === 'NO_SPEECH' ||
                      error.code === 'APP_CHECK_REQUIRED'
                    ? 'failed-precondition'
                    : 'unavailable';
    throw new HttpsError(code, error.code, { code: error.code });
  }
  throw new HttpsError('unavailable', 'SERVICE_UNAVAILABLE', { code: 'SERVICE_UNAVAILABLE' });
}
