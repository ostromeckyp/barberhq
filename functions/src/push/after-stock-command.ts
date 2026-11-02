import { getMessaging } from 'firebase-admin/messaging';
import type { DataConnect } from 'firebase-admin/data-connect';
import { warn } from 'firebase-functions/logger';
import type { CommandResult } from '../../../shared/contracts/stock/index.js';
import { notifyRequestState } from './sender.js';

const NOTIFYING = new Set(['APPROVE', 'REJECT', 'DISPATCH']);

/** Pushes the new request state to the salon; failures never reach the command result. */
export async function notifyAfterStockCommand(
  dc: DataConnect,
  type: string,
  result: CommandResult,
): Promise<void> {
  if (result.replayed || !NOTIFYING.has(type)) return;
  try {
    await notifyRequestState({ dc, messaging: getMessaging(), log: warn }, result.requestId);
  } catch (error) {
    warn('push notification failed', {
      requestId: result.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
