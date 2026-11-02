import { importProvidersFrom } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { EMPTY } from 'rxjs';
import en from '../../public/i18n/en.json';
import { registerAppLocales } from '../app/core/i18n/app-locales';
import { LANGUAGE_STORAGE } from '../app/core/i18n/language-storage';

registerAppLocales();

/** Global test providers: English translations preloaded, language kept out of `localStorage`. */
export default [
  importProvidersFrom(
    TranslocoTestingModule.forRoot({
      langs: { en },
      translocoConfig: { availableLangs: ['en', 'pl'], defaultLang: 'en' },
      preloadLangs: true,
    }),
  ),
  { provide: SwUpdate, useValue: { isEnabled: false, versionUpdates: EMPTY } },
  {
    provide: LANGUAGE_STORAGE,
    useValue: { getItem: () => 'en', setItem: () => undefined },
  },
];
