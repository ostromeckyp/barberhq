import type { TranslatedText } from '../../../core/models/translated-text';

/** Message for a rejected delivery command, chosen by the server's error code. */
export function deliveryCommandError(code: string): TranslatedText {
  return code === 'ALREADY_ACTIVE'
    ? { key: 'delivery.errors.ALREADY_ACTIVE' }
    : code === 'STALE_STATE'
      ? { key: 'delivery.errors.STALE_STATE' }
      : { key: 'delivery.errors.default', params: { code } };
}
