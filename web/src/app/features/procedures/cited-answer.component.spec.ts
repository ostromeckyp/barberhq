import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { expect, it } from 'vitest';
import type { ProcedureResult } from '../../../../../shared/contracts/ai/index';
import { CitedAnswerComponent } from './cited-answer.component';

const answer: Extract<ProcedureResult, { status: 'ANSWER' }> = {
  status: 'ANSWER',
  steps: [{ text: 'Quarantine affected units.', sourceSectionIds: ['chunk-1'] }],
  missingInformation: [],
  sources: [
    {
      businessId: 'business',
      documentId: 'DEMO-DAMAGE-01',
      versionId: 'version-1',
      version: 'v2',
      title: '<script>alert(1)</script> Damaged delivery',
      language: 'en',
      synthetic: true,
      kind: 'procedure',
      origin: 'synthetic',
      superseded: true,
      pageCount: 2,
      chunkId: 'chunk-1',
      sourceSectionId: 'chunk-1',
      sectionId: 'intake',
      physicalPage: 2,
      excerpt: '<img src=x onerror=alert(1)> Keep affected units apart.',
      geometry: { viewBox: [0, 0, 100, 100], userUnit: 1, rotation: 0 },
      rects: [],
      geometryStatus: 'UNAVAILABLE',
    },
  ],
};

it('shows cited steps and opens the exact supporting PDF version and chunk', async () => {
  TestBed.configureTestingModule({
    imports: [CitedAnswerComponent],
    providers: [provideRouter([])],
  });
  const fixture = TestBed.createComponent(CitedAnswerComponent);
  fixture.componentRef.setInput('answer', answer);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  expect(root.textContent).toContain('Quarantine affected units.');
  expect(root.textContent).toContain('Synthetic demo procedure');
  expect(root.textContent).toContain('Historical version');
  expect(root.textContent).toContain('Page 2');
  const pdf = root.querySelector<HTMLAnchorElement>('a[aria-label*="Open PDF"]');
  expect(pdf?.getAttribute('href')).toBe(
    '/procedures/sources/version-1?chunk=chunk-1&page=2&returnTo=assistant',
  );
});

it('escapes source and answer markup instead of inserting elements', async () => {
  TestBed.configureTestingModule({
    imports: [CitedAnswerComponent],
    providers: [provideRouter([])],
  });
  const fixture = TestBed.createComponent(CitedAnswerComponent);
  fixture.componentRef.setInput('answer', {
    ...answer,
    steps: [{ text: '<svg onload=alert(1)>', sourceSectionIds: ['chunk-1'] }],
  });
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  expect(root.textContent).toContain('<svg onload=alert(1)>');
  expect(root.textContent).toContain('<img src=x onerror=alert(1)>');
  expect(root.querySelector('script, img, svg[onload]')).toBeNull();
});

it('links every step directly to its exact source paragraph without duplicating the source card', async () => {
  TestBed.configureTestingModule({
    imports: [CitedAnswerComponent],
    providers: [provideRouter([])],
  });
  const fixture = TestBed.createComponent(CitedAnswerComponent);
  fixture.componentRef.setInput('answer', { ...answer, steps: [...answer.steps, ...answer.steps] });
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  expect(root.querySelectorAll('app-source-excerpt')).toHaveLength(1);
  const citations = root.querySelectorAll<HTMLAnchorElement>('a.citation');
  expect(citations).toHaveLength(2);
  for (const citation of citations) {
    expect(citation.getAttribute('href')).toBe(
      '/procedures/sources/version-1?chunk=chunk-1&page=2&returnTo=assistant',
    );
    expect(citation.textContent).toContain('§ intake');
    expect(citation.getAttribute('aria-label')).toContain('Open paragraph intake');
  }
});
