import { registerLocaleData } from '@angular/common';
import localeEnGb from '@angular/common/locales/en-GB';
import localePl from '@angular/common/locales/pl';

/** Locale data for date formatting in both UI languages (`LOCALE_ID` stays fixed). */
export function registerAppLocales(): void {
  registerLocaleData(localeEnGb, 'en-GB');
  registerLocaleData(localePl, 'pl');
}
