import * as sql from '@barberhq/server';
import { z } from 'zod';
import { buildRequestPush } from './messages.js';
import type { PushDeps } from './models/push-deps.js';

const STATES = ['RESERVED', 'REJECTED', 'DISPATCHED'] as const;
const requestRow = z.object({
  id: z.string(),
  state: z.string(),
  salonId: z.string(),
  salonName: z.string(),
  reason: z.string().nullable().optional(),
});
const tokenRow = z.object({ token: z.string().min(1), locale: z.string() });
const DEAD = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

async function send(deps: PushDeps, requestId: string): Promise<void> {
  const { data } = await sql.pushRecipients(deps.dc, { requestId });
  const request = z.array(requestRow).safeParse(data.request ?? []);
  const row = request.success ? request.data[0] : undefined;
  const state = STATES.find((s) => s === row?.state);
  if (!row || !state) return;
  const tokens = z.array(tokenRow).safeParse(data.tokens ?? []);
  if (!tokens.success || !tokens.data.length) return;
  const byLocale = new Map<'en' | 'pl', string[]>();
  for (const t of tokens.data) {
    const locale = t.locale === 'pl' ? 'pl' : 'en';
    byLocale.set(locale, [...(byLocale.get(locale) ?? []), t.token]);
  }
  const url = `/salons/${row.salonId}/requests/${requestId}`;
  const dead: string[] = [];
  const otherCodes = new Set<string>();
  let failureCount = 0;
  for (const [locale, list] of byLocale) {
    const { title, body } = buildRequestPush({
      state,
      locale,
      salonName: row.salonName,
      requestRef: requestId.slice(0, 8),
      reason: row.reason ?? null,
    });
    const result = await deps.messaging.sendEachForMulticast({
      tokens: list,
      webpush: {
        notification: {
          title,
          body,
          icon: '/icons/icon-192.png',
          badge: '/icons/badge-72.png',
          tag: `request:${requestId}:${state}`,
          renotify: true,
          data: {
            onActionClick: { default: { operation: 'navigateLastFocusedOrOpen', url } },
          },
        },
      },
    });
    failureCount += result.failureCount ?? 0;
    result.responses.forEach((r, i) => {
      if (r.success || !r.error) return;
      const token = list[i];
      if (DEAD.has(r.error.code)) {
        if (token) dead.push(token);
      } else otherCodes.add(r.error.code);
    });
  }
  if (failureCount > 0)
    deps.log?.('push delivery failures', {
      requestId,
      failureCount,
      errorCodes: [...otherCodes],
    });
  if (dead.length) await sql.deletePushTokens(deps.dc, { tokens: dead });
}

/** Best effort: never throws and never waits longer than `timeoutMs`. */
export async function notifyRequestState(deps: PushDeps, requestId: string): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('push timeout')), deps.timeoutMs ?? 2000);
    });
    await Promise.race([send(deps, requestId), timeout]);
  } catch (error) {
    deps.log?.('push notification failed', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timer);
  }
}
