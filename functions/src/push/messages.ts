import type { RequestPushInput } from './models/request-push-input.js';

const TITLES = {
  en: {
    RESERVED: 'Request approved',
    REJECTED: 'Request rejected',
    DISPATCHED: 'Delivery on the way',
  },
  pl: {
    RESERVED: 'Zamówienie zatwierdzone',
    REJECTED: 'Zamówienie odrzucone',
    DISPATCHED: 'Dostawa w drodze',
  },
} as const;

const MAX_REASON = 100;

export function buildRequestPush(input: RequestPushInput): { title: string; body: string } {
  const locale = input.locale === 'pl' ? 'pl' : 'en';
  const base = `${input.salonName} · #${input.requestRef}`;
  const reason = input.state === 'REJECTED' ? input.reason?.trim() : undefined;
  const cut = reason && reason.length > MAX_REASON ? `${reason.slice(0, MAX_REASON)}…` : reason;
  return { title: TITLES[locale][input.state], body: cut ? `${base} — ${cut}` : base };
}
