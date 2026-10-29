import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { expect, it, vi } from 'vitest';
import type { SessionState } from '../../../../../../shared/contracts/business/index';
import { SessionFacade } from '../../auth/feature/session.facade';
import { LoginComponent } from './login.component';

function setup() {
  const state = signal<SessionState>({ status: 'SIGNED_OUT' });
  let complete!: () => void, fail!: (error: Error) => void;
  const signIn = vi.fn(
    () =>
      new Promise<void>((resolve, reject) => {
        complete = resolve;
        fail = reject;
      }),
  );
  TestBed.configureTestingModule({
    imports: [LoginComponent],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
      {
        provide: SessionFacade,
        useValue: { state, signIn, salons: signal([]), home: () => '/hq' },
      },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(LoginComponent);
  fixture.detectChanges();
  return {
    fixture,
    component: fixture.componentInstance,
    root: fixture.nativeElement as HTMLElement,
    state,
    signIn,
    navigate,
    complete: () => complete(),
    fail: () => fail(new Error('auth/invalid-credential')),
  };
}

it('clears the password without a required-field error while valid credentials await membership and redirect', async () => {
  const h = setup();
  h.component.model.set({ email: 'person@example.invalid', password: 'emulator-test-only' });
  const attempt = h.component.signIn(new Event('submit'));
  h.state.set({ status: 'LOADING' });
  h.fixture.detectChanges();
  h.complete();
  await attempt;
  h.fixture.detectChanges();
  expect(h.component.model().password).toBe('');
  expect(h.component.fields.password().touched()).toBe(false);
  expect(h.root.textContent).not.toContain('Password is required.');
  expect(
    h.root.querySelector('input[autocomplete="current-password"]')?.getAttribute('aria-invalid'),
  ).not.toBe('true');
  expect(h.component.facade.error()).toBe('');
  expect(h.component.facade.busy()).toBe(true);
  h.state.set({
    status: 'READY',
    membership: { userId: 'user', businessId: 'business', role: 'HQ', salonIds: [] },
  });
  h.fixture.detectChanges();
  expect(h.navigate).toHaveBeenCalledWith('/hq');
  expect(h.root.textContent).not.toContain('Password is required.');
});

it('shows real credential failures while keeping the cleared password untouched and the feedback space reserved', async () => {
  const h = setup();
  const feedback = h.root.querySelector('.login-feedback');
  expect(feedback).not.toBeNull();
  expect(h.root.querySelector('[role="alert"]')).toBeNull();
  h.component.model.set({ email: 'person@example.invalid', password: 'wrong-test-password' });
  const attempt = h.component.signIn(new Event('submit'));
  h.fail();
  await attempt;
  h.fixture.detectChanges();
  expect(h.root.querySelector('.login-feedback')).toBe(feedback);
  expect(h.root.querySelector('[role="alert"]')?.textContent).toContain('Could not sign in.');
  expect(h.root.textContent).not.toContain('Password is required.');
  expect(h.component.model().password).toBe('');
  expect(h.component.model().email).toBe('person@example.invalid');
  expect(h.navigate).not.toHaveBeenCalled();
});

it('still validates empty credentials and reserves a permanent slot for transient progress', async () => {
  const h = setup();
  const progress = h.root.querySelector('.login-progress');
  expect(progress).not.toBeNull();
  expect(h.root.querySelector('mat-progress-bar')).toBeNull();
  await h.component.signIn(new Event('submit'));
  h.fixture.detectChanges();
  expect(h.root.textContent).toContain('Enter a valid email address.');
  expect(h.root.textContent).toContain('Password is required.');
  expect(h.signIn).not.toHaveBeenCalled();
  expect(h.root.querySelector('.login-progress')).toBe(progress);
});

it('shows delayed progress inside the same reserved slot and removes it after failure', async () => {
  const h = setup();
  const progress = h.root.querySelector('.login-progress');
  const feedbackText = h.root.querySelector('.login-feedback')?.textContent;
  h.component.model.set({ email: 'person@example.invalid', password: 'test-only' });
  const attempt = h.component.signIn(new Event('submit'));
  h.fixture.detectChanges();
  expect(h.root.querySelector('mat-progress-bar')).toBeNull();
  await new Promise((resolve) => setTimeout(resolve, 230));
  h.fixture.detectChanges();
  expect(progress?.querySelector('mat-progress-bar')).not.toBeNull();
  expect(h.root.querySelector('.login-progress')).toBe(progress);
  h.fail();
  await attempt;
  h.fixture.detectChanges();
  expect(h.root.querySelector('mat-progress-bar')).toBeNull();
  expect(h.root.querySelector('.login-progress')).toBe(progress);
  expect(h.root.querySelector('.login-feedback')?.textContent).toBe(feedbackText);
});

it('shows only the failure message in the shared footer, restoring help for a new attempt', async () => {
  const h = setup();
  const help = h.root.querySelector('.login-help-copy');
  expect(help).not.toBeNull();
  expect(help?.getAttribute('aria-hidden')).not.toBe('true');
  h.component.model.set({ email: 'person@example.invalid', password: 'wrong-test-password' });
  const attempt = h.component.signIn(new Event('submit'));
  h.fail();
  await attempt;
  h.fixture.detectChanges();
  expect(help?.getAttribute('aria-hidden')).toBe('true');
  expect(h.root.querySelector('[role="alert"]')?.textContent).toContain('Could not sign in.');
  h.component.model.set({ email: 'person@example.invalid', password: 'another-test-password' });
  const retry = h.component.signIn(new Event('submit'));
  h.fixture.detectChanges();
  expect(help?.getAttribute('aria-hidden')).not.toBe('true');
  expect(h.root.querySelector('[role="alert"]')).toBeNull();
  h.complete();
  await retry;
});
