import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { ClarificationLine } from '../../../../../../shared/contracts/draft/index';
import { ClarificationInput } from './clarification-input';

const base: ClarificationLine = {
  status: 'NEEDS_CLARIFICATION',
  lineId: 'l1',
  originalWording: 'matte paste',
  reason: 'Choose',
  origin: 'assistant',
  candidates: [],
};
const catalog = [
  { productId: 'dry', productName: 'Dry Matt' },
  { productId: 'matowa', productName: 'Matowa' },
];
function render(line: ClarificationLine) {
  const fixture = TestBed.createComponent(ClarificationInput);
  fixture.componentRef.setInput('line', line);
  fixture.componentRef.setInput('products', catalog);
  fixture.detectChanges();
  return fixture;
}
function options(fixture: ReturnType<typeof render>) {
  (fixture.nativeElement.querySelector('.mat-mdc-select-trigger') as HTMLElement).click();
  fixture.detectChanges();
  return Array.from(document.querySelectorAll('mat-option')).map((o) => o.textContent!.trim());
}

describe('ClarificationInput', () => {
  it('lists AI suggestions first with a marker and their reason as plain text', () => {
    const fixture = render({
      ...base,
      candidates: [
        { productId: 'dry', productName: 'Dry Matt' },
        {
          productId: 'matowa',
          productName: 'Matowa',
          suggested: true,
          reason: '<b>Closest</b> name',
        },
      ],
    });
    const texts = options(fixture);
    expect(texts[0]).toContain('Matowa');
    expect(texts[0]).toContain('Suggested');
    expect(texts[0]).toContain('<b>Closest</b> name');
    expect(texts[1]).toBe('Dry Matt');
    expect(document.querySelector('mat-option b')).toBeNull();
  });

  it('renders plain candidates exactly as before, without a marker', () => {
    const fixture = render({ ...base, candidates: catalog });
    expect(options(fixture)).toEqual(['Dry Matt', 'Matowa']);
  });

  it('answers an AI quantity question with the suggested product and the quantity', () => {
    const fixture = render({
      ...base,
      reasonCode: 'ENTER_QUANTITY',
      candidates: [
        { productId: 'matowa', productName: 'Matowa', suggested: true, reason: 'Closest' },
        { productId: 'dry', productName: 'Dry Matt' },
      ],
    });
    const emitted: unknown[] = [];
    fixture.componentInstance.resolved.subscribe((v) => emitted.push(v));
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    input.value = '4';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    expect(emitted).toEqual([{ productId: 'matowa', quantity: 4 }]);
  });
});
