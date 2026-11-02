import type { DataConnect } from 'firebase-admin/data-connect';
import type { Messaging } from 'firebase-admin/messaging';

export type PushDeps = {
  dc: DataConnect;
  messaging: Pick<Messaging, 'sendEachForMulticast'>;
  timeoutMs?: number;
  log?: (message: string, meta: object) => void;
};
