import type { TranslatedText } from '../../core/models/translated-text';

/** An error whose user-facing message is a translation key, rendered by the template. */
export class TranslatedError extends Error {
  constructor(readonly text: TranslatedText) {
    super(text.key);
  }
}

/** The translated message of `error`, or `fallback` for any other error. */
export function translatedErrorText(error: unknown, fallback: TranslatedText): TranslatedText {
  return error instanceof TranslatedError ? error.text : fallback;
}
