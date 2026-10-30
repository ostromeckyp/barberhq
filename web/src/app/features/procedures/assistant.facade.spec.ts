import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expect, it, vi } from 'vitest';
import { Language } from '../../core/language';
import { AssistantApi, AssistantApiError } from '../../core/assistant-api';
import { SalonContext } from '../../core/salon-context';
import { SessionFacade } from '../auth/feature/session.facade';
import { AssistantFacade } from './assistant.facade';
import { convertToParamMap } from '@angular/router';

const membership = {
  userId: 'user-1',
  businessId: 'business',
  role: 'HQ' as const,
  salonIds: [] as string[],
};
function setup(request: () => Promise<unknown>, language: 'en' | 'pl' = 'en') {
  const session = signal({ status: 'READY' as const, membership });
  const workspace = signal<{ kind: 'HQ' } | { kind: 'SALON'; salonId: string }>({ kind: 'HQ' });
  TestBed.configureTestingModule({
    providers: [
      AssistantFacade,
      { provide: AssistantApi, useValue: { answerProcedureQuestion: request } },
      { provide: SessionFacade, useValue: { state: session } },
      { provide: Language, useValue: { current: signal(language) } },
      { provide: SalonContext, useValue: { workspace } },
    ],
  });
  const facade = TestBed.inject(AssistantFacade);
  TestBed.flushEffects();
  return { facade, session, workspace };
}

it('submits one English question and ignores duplicate clicks while pending', async () => {
  let complete!: (value: unknown) => void;
  const request = vi.fn(
    () =>
      new Promise<unknown>((resolve) => {
        complete = resolve;
      }),
  );
  const { facade } = setup(request);
  facade.question.set('  What if DEMO-DAMAGE-01 is damaged?  ');
  const first = facade.submit();
  const second = facade.submit();
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith({
    question: 'What if DEMO-DAMAGE-01 is damaged?',
    answerLanguage: 'en',
  });
  complete({ status: 'INSUFFICIENT_EVIDENCE', message: 'No supported instruction.', sources: [] });
  await Promise.all([first, second]);
  expect(facade.result()).toMatchObject({ status: 'INSUFFICIENT_EVIDENCE' });
  expect(facade.loading()).toBe(false);
});

it('clears the question and discards an old result when the workspace changes', async () => {
  let complete!: (value: unknown) => void;
  const { facade, workspace } = setup(
    () =>
      new Promise<unknown>((resolve) => {
        complete = resolve;
      }),
  );
  facade.question.set('How should I handle damage?');
  const pending = facade.submit();
  workspace.set({ kind: 'SALON', salonId: 'salon-2' });
  TestBed.flushEffects();
  complete({
    status: 'ANSWER',
    steps: [{ text: 'Old answer', sourceSectionIds: [] }],
    sources: [],
    missingInformation: [],
  });
  await pending;
  expect(facade.question()).toBe('');
  expect(facade.result()).toBeNull();
  expect(facade.loading()).toBe(false);
});

it('shows a controlled operational error without preserving the previous answer', async () => {
  const { facade } = setup(() => Promise.reject(new AssistantApiError('RATE_LIMITED')));
  facade.question.set('Can I replace it?');
  await facade.submit();
  expect(facade.result()).toBeNull();
  expect(facade.error()).toEqual({ key: 'procedures.assistant.errors.RATE_LIMITED' });
});

it('clears retained guidance when a different account enters the same workspace', async () => {
  const { facade, session } = setup(async () => ({
    status: 'INSUFFICIENT_EVIDENCE',
    message: 'Private context.',
    sources: [],
  }));
  facade.question.set('A question from the first account');
  await facade.submit();
  session.set({ status: 'READY', membership: { ...membership, userId: 'user-2' } });
  TestBed.flushEffects();
  expect(facade.question()).toBe('');
  expect(facade.result()).toBeNull();
  expect(facade.error()).toBeNull();
});

// The answer must keep the question it actually answered, even while the next input is edited.
it('retains the submitted question until guidance is cleared', async () => {
  const { facade } = setup(async () => ({
    status: 'ANSWER',
    steps: [],
    sources: [],
    missingInformation: [],
  }));
  facade.question.set('  Original question  ');
  await facade.submit();
  facade.question.set('Next question');
  expect(facade.submittedQuestion()).toBe('Original question');
  facade.reset();
  expect(facade.submittedQuestion()).toBe('');
});

it('retains delivery return on Clear, revalidates access, and clears it on workspace change', () => {
  const request = vi.fn();
  const h = setup(request);
  h.workspace.set({ kind: 'SALON', salonId: 'salon-2' });
  h.session.set({ status: 'READY', membership: { ...membership, salonIds: ['salon-2'] } });
  TestBed.flushEffects();
  expect(
    h.facade.suggestDeliveryQuestion(
      convertToParamMap({
        deliveryProblem: 'DAMAGED',
        returnTo: 'delivery-receipt',
        salonId: 'salon-2',
        requestId: 'request',
      }),
    ),
  ).toBe(true);
  expect(h.facade.deliveryBack()?.labelKey).toBe('procedures.back.checkDelivery');
  h.facade.reset();
  expect(h.facade.deliveryBack()?.labelKey).toBe('procedures.back.checkDelivery');
  expect(h.facade.question()).toBe('');
  h.session.set({ status: 'READY', membership });
  expect(h.facade.deliveryBack()).toBeNull();
  h.workspace.set({ kind: 'HQ' });
  TestBed.flushEffects();
  expect(h.facade.deliveryBack()).toBeNull();
  expect(request).not.toHaveBeenCalled();
});

it('sends the current UI language', async () => {
  const request = vi.fn(() =>
    Promise.resolve({ status: 'INSUFFICIENT_EVIDENCE', message: '', sources: [] }),
  );
  const { facade } = setup(request, 'pl');
  facade.question.set('Co zrobić z uszkodzonym produktem?');
  await facade.submit();
  expect(request).toHaveBeenCalledWith({
    question: 'Co zrobić z uszkodzonym produktem?',
    answerLanguage: 'pl',
  });
});
