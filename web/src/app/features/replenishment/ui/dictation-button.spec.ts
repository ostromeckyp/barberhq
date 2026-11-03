import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expect, it } from 'vitest';
import { provideTransloco } from '@jsverse/transloco';
import { DictationFacade } from '../feature/dictation.facade';
import { DictationButton } from './dictation-button';

function render(visible: boolean, state = 'idle') {
  TestBed.configureTestingModule({
    imports: [DictationButton],
    providers: [
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en' } }),
      {
        provide: DictationFacade,
        useValue: {
          visible: () => visible,
          state: signal(state),
          elapsedMs: signal(3000),
          errorKey: signal(null),
          canRetry: () => false,
          toggle: () => undefined,
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(DictationButton);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

it('is hidden when dictation is unavailable', () => {
  expect(render(false).querySelector('button')).toBeNull();
});

it('shows the mic button when available and elapsed seconds while recording', () => {
  expect(render(true).querySelector('button')).not.toBeNull();
  TestBed.resetTestingModule();
  expect(render(true, 'recording').textContent).toContain('0:03');
});
