import type { AppLanguage } from '../models/app-language';

/** Key of the plural form for `n`: `.one|few|many` in Polish, `.one|other` in English. */
export function pluralKey(base: string, n: number, lang: AppLanguage): string {
  if (lang === 'en') return `${base}.${n === 1 ? 'one' : 'other'}`;
  if (n === 1) return `${base}.one`;
  const tens = n % 100;
  const units = n % 10;
  return `${base}.${units >= 2 && units <= 4 && (tens < 12 || tens > 14) ? 'few' : 'many'}`;
}
