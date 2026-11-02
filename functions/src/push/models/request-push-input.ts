export type RequestPushInput = {
  state: 'RESERVED' | 'REJECTED' | 'DISPATCHED';
  locale: 'en' | 'pl';
  salonName: string;
  requestRef: string;
  reason: string | null;
};
