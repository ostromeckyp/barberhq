import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { expect, it, vi } from 'vitest';
import type { ProcedureResult } from '../../../../../shared/contracts/ai/index';
import { AssistantFacade } from './assistant.facade';
import { ProcedureAssistantComponent } from './procedure-assistant.component';

function render(result: ProcedureResult | null, error = '') {
  const facade = {
    question: signal('What does the procedure say?'),
    loading: signal(false),
    result: signal(result),
    error: signal(error),
    canSubmit: signal(true),
    submit: vi.fn(),
  };
  TestBed.configureTestingModule({
    imports: [ProcedureAssistantComponent],
    providers: [provideRouter([])],
  });
  TestBed.overrideComponent(ProcedureAssistantComponent, {
    set: { providers: [{ provide: AssistantFacade, useValue: facade }] },
  });
  const fixture = TestBed.createComponent(ProcedureAssistantComponent);
  fixture.detectChanges();
  return { root: fixture.nativeElement as HTMLElement, facade };
}

it('shows an unsupported answer without inventing procedural steps or PDF links', () => {
  const { root } = render({
    status: 'INSUFFICIENT_EVIDENCE',
    message: 'No source supports a deadline.',
    sources: [],
  });
  expect(root.textContent).toContain('No source supports a deadline.');
  expect(root.querySelector('app-cited-answer')).toBeNull();
  expect(root.querySelector('a[href*="/procedures/sources/"]')).toBeNull();
});

it('shows a clarification request and operational error as distinct states', () => {
  const clarified = render({
    status: 'NEEDS_CLARIFICATION',
    question: 'Which product was affected?',
    sources: [],
  });
  expect(clarified.root.textContent).toContain('Which product was affected?');
  expect(clarified.root.querySelector('app-cited-answer')).toBeNull();
  TestBed.resetTestingModule();
  const failed = render(null, 'There are too many requests. Please try again later.');
  expect(failed.root.querySelector('[role="alert"]')?.textContent).toContain('too many requests');
});
