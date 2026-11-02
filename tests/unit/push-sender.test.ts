import { beforeEach, describe, expect, it, vi } from 'vitest';

const sql = vi.hoisted(() => ({ pushRecipients: vi.fn(), deletePushTokens: vi.fn() }));
vi.mock('@barberhq/server', () => sql);
vi.mock('../../functions/src/generated/esm/index.esm.js', () => sql);

import { notifyRequestState } from '../../functions/src/push/sender.ts';

const id = '11111111-2222-3333-4444-555555555555';
const dc = {} as never;
const recipients = (tokens: { token: string; locale: string }[], state = 'RESERVED') =>
  sql.pushRecipients.mockResolvedValue({
    data: {
      request: [{ id, state, salonId: 's1', salonName: 'Salon A', reason: null }],
      tokens,
    },
  });
const ok = { success: true };

beforeEach(() => {
  sql.pushRecipients.mockReset();
  sql.deletePushTokens.mockReset();
});

describe('notifyRequestState', () => {
  it('sends one multicast per locale with tag, url, icon and badge', async () => {
    recipients([
      { token: 'a', locale: 'en' },
      { token: 'b', locale: 'pl' },
      { token: 'c', locale: 'en' },
    ]);
    const sendEachForMulticast = vi.fn(async (m: { tokens: string[] }) => ({
      responses: m.tokens.map(() => ok),
    }));
    await notifyRequestState({ dc, messaging: { sendEachForMulticast } as never }, id);
    expect(sendEachForMulticast).toHaveBeenCalledTimes(2);
    const first = sendEachForMulticast.mock.calls[0]![0] as never as {
      tokens: string[];
      webpush: { notification: Record<string, unknown> } & Record<string, unknown>;
    };
    expect(first.tokens).toEqual(['a', 'c']);
    const n = first.webpush.notification;
    expect(n).toMatchObject({
      title: 'Request approved',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: `request:${id}:RESERVED`,
      renotify: true,
      data: {
        onActionClick: {
          default: {
            operation: 'navigateLastFocusedOrOpen',
            url: `/salons/s1/requests/${id}`,
          },
        },
      },
    });
    expect(first.webpush).not.toHaveProperty('fcmOptions');
    const second = sendEachForMulticast.mock.calls[1]![0] as never as {
      tokens: string[];
      webpush: { notification: { title: string } };
    };
    expect(second.tokens).toEqual(['b']);
    expect(second.webpush.notification.title).toBe('Zamówienie zatwierdzone');
  });

  it('sends nothing without tokens, a request, or a notifiable state', async () => {
    const sendEachForMulticast = vi.fn();
    const deps = { dc, messaging: { sendEachForMulticast } as never };
    recipients([]);
    await notifyRequestState(deps, id);
    sql.pushRecipients.mockResolvedValue({
      data: { request: [], tokens: [{ token: 'a', locale: 'en' }] },
    });
    await notifyRequestState(deps, id);
    recipients([{ token: 'a', locale: 'en' }], 'SUBMITTED');
    await notifyRequestState(deps, id);
    expect(sendEachForMulticast).not.toHaveBeenCalled();
  });

  it('deletes exactly the tokens reported as dead', async () => {
    recipients([
      { token: 'a', locale: 'en' },
      { token: 'b', locale: 'en' },
      { token: 'c', locale: 'en' },
    ]);
    const sendEachForMulticast = vi.fn(async () => ({
      responses: [
        { success: false, error: { code: 'messaging/registration-token-not-registered' } },
        { success: false, error: { code: 'messaging/internal-error' } },
        { success: false, error: { code: 'messaging/invalid-registration-token' } },
      ],
    }));
    await notifyRequestState({ dc, messaging: { sendEachForMulticast } as never }, id);
    expect(sql.deletePushTokens).toHaveBeenCalledWith(dc, { tokens: ['a', 'c'] });
  });

  it('logs a warning with the distinct non-dead error codes, never tokens', async () => {
    recipients([
      { token: 'secret-a', locale: 'en' },
      { token: 'secret-b', locale: 'en' },
      { token: 'secret-c', locale: 'en' },
    ]);
    const log = vi.fn();
    const sendEachForMulticast = vi.fn(async () => ({
      failureCount: 3,
      responses: [
        { success: false, error: { code: 'messaging/internal-error' } },
        { success: false, error: { code: 'messaging/internal-error' } },
        { success: false, error: { code: 'messaging/registration-token-not-registered' } },
      ],
    }));
    await notifyRequestState({ dc, messaging: { sendEachForMulticast } as never, log }, id);
    expect(log).toHaveBeenCalledOnce();
    const [, fields] = log.mock.calls[0]!;
    expect(fields).toMatchObject({
      requestId: id,
      failureCount: 3,
      errorCodes: ['messaging/internal-error'],
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret');
    expect(sql.deletePushTokens).toHaveBeenCalledWith(dc, { tokens: ['secret-c'] });
  });

  it('logs and swallows a send failure', async () => {
    recipients([{ token: 'a', locale: 'en' }]);
    const log = vi.fn();
    const sendEachForMulticast = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(
      notifyRequestState({ dc, messaging: { sendEachForMulticast } as never, log }, id),
    ).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ requestId: id }),
    );
  });

  it('resolves after the timeout when sending never settles', async () => {
    recipients([{ token: 'a', locale: 'en' }]);
    const log = vi.fn();
    const sendEachForMulticast = vi.fn(() => new Promise(() => {}));
    await notifyRequestState(
      { dc, messaging: { sendEachForMulticast } as never, timeoutMs: 20, log },
      id,
    );
    expect(log).toHaveBeenCalledOnce();
  });
});
