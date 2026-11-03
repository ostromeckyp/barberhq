import type { Auth } from 'firebase/auth';
import type { ClientLogEvent, LogChannel } from '../../../../shared/contracts/logging/index';
import { channelFor } from './log-channel';
import { runtimeConfig } from './public-config';

/** What `ClientLog` needs from the browser and Firebase; replaced in tests. */
export interface ClientLogPort {
  token(): Promise<string | null>;
  online(): boolean;
  channel(): LogChannel;
  send(events: ClientLogEvent[], token: string): Promise<number>;
}

function endpoint(): string | null {
  const c = runtimeConfig.publicConfig;
  if (!c) return null;
  return runtimeConfig.useEmulators
    ? `http://127.0.0.1:5001/${c.projectId}/${c.functionsRegion}/clientLog`
    : `https://${c.functionsRegion}-${c.projectId}.cloudfunctions.net/clientLog`;
}

/** Posts to the `clientLog` function with the ID token only; never waits for App Check. */
export function createClientLogPort(auth: () => Auth): ClientLogPort {
  return {
    token: async () => {
      const user = auth().currentUser;
      return user ? user.getIdToken() : null;
    },
    online: () => typeof navigator === 'undefined' || navigator.onLine !== false,
    channel: () => channelFor(location.hostname),
    send: async (events, token) => {
      const url = endpoint();
      if (!url) return 0;
      const response = await fetch(url, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ events }),
      });
      return response.status;
    },
  };
}
