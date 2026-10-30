import { DOCUMENT, Service, computed, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { LANGUAGE_STORAGE } from './i18n/language-storage';
import type { AppLanguage } from './models/app-language';

const storageKey = 'barberhq.language';

const isAppLanguage = (value: unknown): value is AppLanguage => value === 'en' || value === 'pl';

/** Stored choice, else the browser language (`pl*` → Polish), else English. */
export function initialLanguage(storage: Pick<Storage, 'getItem'>): AppLanguage {
  try {
    const stored = storage.getItem(storageKey);
    if (isAppLanguage(stored)) return stored;
  } catch {
    /* Browser storage may be blocked; fall back to the browser language. */
  }
  return globalThis.navigator?.language?.toLowerCase().startsWith('pl') ? 'pl' : 'en';
}

/** The UI language: persisted per browser, drives translations and date formatting. */
@Service()
export class Language {
  private readonly storage = inject(LANGUAGE_STORAGE);
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);
  private readonly language = signal(initialLanguage(this.storage));
  readonly current = this.language.asReadonly();
  readonly locale = computed(() => (this.language() === 'pl' ? 'pl' : 'en-GB'));

  constructor() {
    this.document.documentElement.lang = this.language();
  }

  set(lang: AppLanguage): void {
    this.language.set(lang);
    try {
      this.storage.setItem(storageKey, lang);
    } catch {
      /* Browser storage may be blocked; the choice lasts for this page only. */
    }
    this.transloco.setActiveLang(lang);
    this.document.documentElement.lang = lang;
  }
}
