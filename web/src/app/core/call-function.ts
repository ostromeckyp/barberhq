import { httpsCallable } from 'firebase/functions';
import type { Functions } from 'firebase/functions';
import { aiOps } from '../../../../shared/contracts/functions/index';
import type { AiOp, CommandOp } from '../../../../shared/contracts/functions/index';

/**
 * Calls one operation of the `commands` or `ai` callable. Waits for App Check first, so no
 * callable goes out without a token. Errors from the callable propagate unchanged.
 */
export async function callFunction<I, O>(
  firebase: { functions: Functions; appCheck: () => Promise<unknown> },
  op: CommandOp | AiOp,
  input: I,
): Promise<O> {
  await firebase.appCheck();
  const name = (aiOps as readonly string[]).includes(op) ? 'ai' : 'commands';
  const response = await httpsCallable<{ op: CommandOp | AiOp; input: I }, O>(
    firebase.functions,
    name,
  )({ op, input });
  return response.data;
}
