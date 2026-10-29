import { Component, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { afterEach, expect, it, vi } from 'vitest';
import { BehaviorSubject } from 'rxjs';
import type { PublicConfig } from '../../../../../scripts/config/public-config';
import { runtimeConfig } from '../../core/public-config';
import { DocumentLibraryComponent } from './document-library.component';
import { ProcedureAssistantComponent } from './procedure-assistant.component';
import { ProcedurePageComponent } from './procedure-page.component';
import { AssistantFacade } from './assistant.facade';
import { AssistantApi } from '../../core/assistant-api';
import { SessionFacade } from '../auth/feature/session.facade';
import { SalonContext } from '../../core/salon-context';

@Component({ selector: 'app-document-library', template: '<span>Document library</span>' })
class DocsStub {
  readonly embedded = input(false);
}
@Component({ selector: 'app-procedure-assistant', template: '<span>Assistant pane</span>' })
class AssistantStub {}

const previousConfig = runtimeConfig.publicConfig;
afterEach(() => {
  runtimeConfig.publicConfig = previousConfig;
});

const member = {
  userId: 'user',
  businessId: 'business',
  role: 'SALON' as const,
  salonIds: ['salon'],
};
let query: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
const submit = vi.fn();
function render(tab: string | null, ragEnabled: boolean, extra: Record<string, string> = {}) {
  runtimeConfig.publicConfig = { knowledgeEnabled: true, ragEnabled } as PublicConfig;
  query = new BehaviorSubject(convertToParamMap({ ...(tab ? { tab } : {}), ...extra }));
  submit.mockClear();
  TestBed.configureTestingModule({
    imports: [ProcedurePageComponent],
    providers: [
      provideRouter([]),
      AssistantFacade,
      { provide: AssistantApi, useValue: { answerProcedureQuestion: submit } },
      {
        provide: SessionFacade,
        useValue: { state: signal({ status: 'READY', membership: member }) },
      },
      {
        provide: SalonContext,
        useValue: { workspace: signal({ kind: 'SALON', salonId: 'salon' }) },
      },
      {
        provide: ActivatedRoute,
        useValue: {
          queryParamMap: query,
          snapshot: { queryParamMap: query.value },
        },
      },
    ],
  });
  TestBed.overrideComponent(ProcedurePageComponent, {
    remove: { imports: [DocumentLibraryComponent, ProcedureAssistantComponent] },
    add: { imports: [DocsStub, AssistantStub] },
  });
  const fixture = TestBed.createComponent(ProcedurePageComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

it('keeps the document library available when RAG is disabled', () => {
  const root = render(null, false);
  expect(root.textContent).toContain('Document library');
  expect(root.textContent).not.toContain('Assistant pane');
});

const deliveryQuery = {
  returnTo: 'delivery-receipt',
  salonId: 'salon',
  requestId: 'request',
  filter: 'ACTIVE',
  offset: '20',
};
it.each([
  ['DAMAGED', 'W dostawie są uszkodzone produkty. Jak postąpić zgodnie z procedurą?'],
  ['MISSING', 'W dostawie brakuje produktów. Jak postąpić zgodnie z procedurą?'],
  [
    'BOTH',
    'W dostawie są uszkodzone produkty i brakuje części produktów. Jak postąpić zgodnie z procedurą?',
  ],
])(
  'prefills %s without sending and keeps edits through ordinary query/tab changes',
  (deliveryProblem, expected) => {
    render(null, true, { ...deliveryQuery, deliveryProblem });
    const facade = TestBed.inject(AssistantFacade);
    expect(facade.question()).toBe(expected);
    expect(submit).not.toHaveBeenCalled();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    facade.question.set('My edited question');
    query.next(convertToParamMap({ ...deliveryQuery, tab: 'documents' }));
    TestBed.flushEffects();
    expect(facade.question()).toBe('My edited question');
    query.next(convertToParamMap({})); // existing cited PDF back route
    TestBed.flushEffects();
    const fixture = TestBed.createComponent(ProcedurePageComponent);
    fixture.detectChanges();
    const back = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Check delivery'),
    );
    expect(back).toBeDefined();
    back!.click();
    expect(navigate).toHaveBeenCalledWith(['/salons', 'salon', 'requests', 'request', 'receipt'], {
      queryParams: { filter: 'ACTIVE', offset: 20 },
    });
  },
);

it('consumes the suggestion marker and ignores foreign or arbitrary return inputs', () => {
  render(null, true, { ...deliveryQuery, salonId: 'other', deliveryProblem: 'DAMAGED' });
  expect(TestBed.inject(AssistantFacade).question()).toBe('');
  TestBed.resetTestingModule();
  render(null, true, {
    ...deliveryQuery,
    requestId: 'https://example.com',
    deliveryProblem: 'DAMAGED',
  });
  expect(TestBed.inject(AssistantFacade).question()).toBe('');
  TestBed.resetTestingModule();
  const navigate = vi.spyOn(Router.prototype, 'navigate').mockResolvedValue(true);
  render(null, true, { ...deliveryQuery, deliveryProblem: 'DAMAGED' });
  expect(navigate).toHaveBeenCalledWith(
    [],
    expect.objectContaining({
      queryParams: { deliveryProblem: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    }),
  );
  navigate.mockRestore();
});

it('preserves the documents query tab when the assistant is enabled', () => {
  const root = render('documents', true);
  expect(root.textContent).toContain('Document library');
  expect(root.textContent).not.toContain('Assistant pane');
});

it('opens the assistant by default only when both feature flags are enabled', () => {
  const root = render(null, true);
  expect(root.textContent).toContain('Assistant pane');
  expect(root.textContent).not.toContain('Document library');
});
