import type { AppLanguage } from '../models/app-language';

/** Each language is named in its own language, so these labels are never translated. */
export const LANGUAGE_OPTIONS: readonly { value: AppLanguage; label: string }[] = [
  { value: 'pl', label: 'Polski' },
  { value: 'en', label: 'English' },
];
