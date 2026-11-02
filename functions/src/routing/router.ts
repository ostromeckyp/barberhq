import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';

interface RoutedOperation {
  run(request: CallableRequest): unknown;
}

/**
 * Dispatches `{ op, input }` to an existing callable through its `run` method. The handler gets
 * the original request with only `data` replaced, so auth, App Check and `rawRequest` (which the
 * knowledge callables read for token re-verification) are unchanged.
 */
export function createRouter(ops: Record<string, RoutedOperation>) {
  return async (request: CallableRequest) => {
    const data: unknown = request.data;
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      throw new HttpsError('invalid-argument', 'INVALID_OPERATION');
    }
    const { op, input } = data as { op?: unknown; input?: unknown };
    // `input` must be present; `input: null` stays valid for ops that take no arguments.
    if (typeof op !== 'string' || !Object.hasOwn(ops, op) || !Object.hasOwn(data, 'input')) {
      throw new HttpsError('invalid-argument', 'INVALID_OPERATION');
    }
    return ops[op].run({ ...request, data: input });
  };
}
