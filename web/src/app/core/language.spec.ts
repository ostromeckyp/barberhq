import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LANGUAGE_STORAGE } from './i18n/language-storage';
import { Language } from './language';

const key = 'barberhq.language';

function setup(browserLanguage = 'en-US') {
  vi.spyOn(navigator, 'language', 'get').mockReturnValue(browserLanguage);
  TestBed.configureTestingModule({
    providers: [{ provide: LANGUAGE_STORAGE, useFactory: () => globalThis.localStorage }],
  });
  return TestBed.inject(Language);
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

it('defaults to pl when nothing stored and navigator.language is pl-PL', () => {
  const language = setup('pl-PL');
  expect(language.current()).toBe('pl');
  expect(language.locale()).toBe('pl');
});

it('defaults to en for de-DE', () => {
  const language = setup('de-DE');
  expect(language.current()).toBe('en');
  expect(language.locale()).toBe('en-GB');
});

it('stored choice wins over browser language', () => {
  localStorage.setItem(key, 'en');
  expect(setup('pl-PL').current()).toBe('en');
});

it('ignores invalid stored value', () => {
  localStorage.setItem(key, 'de');
  expect(setup('pl-PL').current()).toBe('pl');
});

it('survives localStorage throwing', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  const language = setup('pl-PL');
  expect(language.current()).toBe('pl');
  vi.spyOn(TestBed.inject(TranslocoService), 'setActiveLang');
  expect(() => language.set('en')).not.toThrow();
  expect(language.current()).toBe('en');
});

it('set persists, updates html lang and Transloco active lang', () => {
  const language = setup('en-US');
  const transloco = TestBed.inject(TranslocoService);
  const setActiveLang = vi.spyOn(transloco, 'setActiveLang').mockReturnValue(transloco);
  language.set('pl');
  expect(language.current()).toBe('pl');
  expect(language.locale()).toBe('pl');
  expect(localStorage.getItem(key)).toBe('pl');
  expect(document.documentElement.lang).toBe('pl');
  expect(setActiveLang).toHaveBeenCalledWith('pl');
});
