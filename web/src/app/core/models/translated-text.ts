/** A translation key with optional interpolation params, rendered by the template. */
export interface TranslatedText {
  key: string;
  params?: Record<string, unknown>;
}
