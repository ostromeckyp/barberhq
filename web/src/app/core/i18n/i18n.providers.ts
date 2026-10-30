import {
  EnvironmentProviders,
  inject,
  isDevMode,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { initialLanguage, Language } from '../language';
import { registerAppLocales } from './app-locales';
import { browserLanguageStorage } from './language-storage';
import { FetchTranslocoLoader } from './transloco-loader';

/** Transloco with English fallback; the active language is loaded before first render. */
export function provideI18n(): EnvironmentProviders {
  registerAppLocales();
  return makeEnvironmentProviders([
    provideTransloco({
      config: {
        availableLangs: ['en', 'pl'],
        defaultLang: initialLanguage(browserLanguageStorage),
        fallbackLang: 'en',
        missingHandler: { useFallbackTranslation: true },
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: FetchTranslocoLoader,
    }),
    provideAppInitializer(() => {
      const lang = inject(Language).current();
      const transloco = inject(TranslocoService);
      transloco.setActiveLang(lang);
      // A failed load must not block the app; Transloco falls back to English.
      return firstValueFrom(transloco.load(lang)).catch(() => undefined);
    }),
  ]);
}
