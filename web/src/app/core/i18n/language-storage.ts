import { InjectionToken } from '@angular/core';

// Kept apart from `Language` so test setup can override it without loading Transloco early.

/** `localStorage`, resolved on each call because merely reading it can throw. */
export const browserLanguageStorage: Pick<Storage, 'getItem' | 'setItem'> = {
  getItem: (key) => globalThis.localStorage.getItem(key),
  setItem: (key, value) => globalThis.localStorage.setItem(key, value),
};

export const LANGUAGE_STORAGE = new InjectionToken<Pick<Storage, 'getItem' | 'setItem'>>(
  'UI language storage',
  { factory: () => browserLanguageStorage },
);
