import type { LogChannel } from './log-channel.js';

/** One browser step or error; never carries user content. The server adds the verified uid. */
export interface ClientLogEvent {
  event: string;
  outcome: 'ok' | 'error';
  code?: string;
  durationMs?: number;
  sessionId: string;
  build: string;
  channel: LogChannel;
  clientTime: string;
  role?: 'HQ' | 'SALON';
  businessId?: string;
  salonId?: string;
  details?: Record<string, string | number | boolean>;
}
