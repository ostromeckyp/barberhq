import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { expect, it, vi } from 'vitest';
import { Language } from '../language';
import { TranslatedTitleStrategy } from './translated-title.strategy';

function setup() {
  TestBed.configureTestingModule({ providers: [TranslatedTitleStrategy] });
  const strategy = TestBed.inject(TranslatedTitleStrategy);
  vi.spyOn(strategy, 'buildTitle').mockReturnValue('shell.titles.signIn');
  return { strategy, document: TestBed.inject(DOCUMENT), language: TestBed.inject(Language) };
}

it('sets the English title and re-sets it when the language changes', () => {
  const { strategy, document, language } = setup();
  const transloco = TestBed.inject(TranslocoService);
  transloco.setTranslation({ shell: { titles: { signIn: 'Logowanie · BarberHQ' } } }, 'pl');
  strategy.updateTitle({} as RouterStateSnapshot);
  TestBed.tick();
  expect(document.title).toBe('Sign in · BarberHQ');
  language.set('pl');
  TestBed.tick();
  expect(document.title).toBe('Logowanie · BarberHQ');
  expect(strategy).toBeInstanceOf(TitleStrategy);
});
