import type { LogChannel } from '../../../../shared/contracts/logging/index';

/** Preview channels are `<site>--<channel>-<hash>.web.app`; promote serves the same build live. */
export function channelFor(hostname: string): LogChannel {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'local';
  return hostname.split('.')[0].includes('--') ? 'preview' : 'live';
}
