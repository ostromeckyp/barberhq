import { expect, it } from 'vitest';
import { AiError } from '../../functions/src/ai/budget.ts';
import type { AiErrorCode } from '../../functions/src/ai/models/ai-error-code.ts';
import { publicAiError } from '../../functions/src/ai/errors.ts';
import { publicAiError as procedureMapper } from '../../functions/src/ai/procedure.ts';

const mapped = (error: unknown) => {
  try {
    publicAiError(error);
  } catch (e) {
    const h = e as { code: string; message: string; details: unknown };
    return [h.code, h.message, h.details];
  }
};
it('pins the public AI error mapping shared by procedure, replenishment and shorthand', () => {
  const expected: [AiErrorCode, string][] = [
    ['UNAUTHENTICATED', 'unauthenticated'],
    ['FORBIDDEN', 'permission-denied'],
    ['VALIDATION_ERROR', 'invalid-argument'],
    ['RATE_LIMITED', 'resource-exhausted'],
    ['MODEL_LIMIT', 'resource-exhausted'],
    ['TOOL_LIMIT', 'resource-exhausted'],
    ['TIMEOUT', 'deadline-exceeded'],
    ['SOURCE_CHANGED', 'aborted'],
    ['INVALID_CONFIG', 'failed-precondition'],
    ['EMBEDDING_CONFIG_MISMATCH', 'failed-precondition'],
    ['APP_CHECK_REQUIRED', 'failed-precondition'],
    ['PROVIDER_UNAVAILABLE', 'unavailable'],
    ['SERVICE_UNAVAILABLE', 'unavailable'],
    ['INVALID_MODEL_OUTPUT', 'unavailable'],
  ];
  for (const [code, status] of expected)
    expect(mapped(new AiError(code))).toEqual([status, code, { code }]);
  expect(mapped(new Error('provider stack'))).toEqual([
    'unavailable',
    'SERVICE_UNAVAILABLE',
    { code: 'SERVICE_UNAVAILABLE' },
  ]);
  expect(procedureMapper).toBe(publicAiError);
});
