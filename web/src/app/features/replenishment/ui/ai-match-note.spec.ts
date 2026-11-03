import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { AiMatch } from '../../../../../../shared/contracts/draft/index';
import { AiMatchNote } from './ai-match-note';

const match: AiMatch = {
  originalWording: 'matte paste',
  reason: '<img src=x onerror=alert(1)> closest name',
  alternatives: [{ productId: 'dry', productName: 'Dry Matt' }],
  choiceReceiptId: 'r1',
};
function render(locked = false) {
  const fixture = TestBed.createComponent(AiMatchNote);
  fixture.componentRef.setInput('match', match);
  fixture.componentRef.setInput('productName', 'Matowa');
  fixture.componentRef.setInput('locked', locked);
  fixture.detectChanges();
  return fixture;
}

describe('AiMatchNote', () => {
  it('labels the AI match and shows the reason as plain text', () => {
    const el: HTMLElement = render().nativeElement;
    expect(el.textContent).toContain('Matched by AI');
    expect(el.textContent).toContain('<img src=x onerror=alert(1)> closest name');
    expect(el.querySelector('img')).toBeNull();
  });

  it('asks to change the product when Change is pressed', () => {
    const fixture = render();
    let changed = 0;
    fixture.componentInstance.change.subscribe(() => changed++);
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.textContent).toContain('Change');
    expect(button.getAttribute('aria-label')).toContain('Matowa');
    button.click();
    expect(changed).toBe(1);
  });

  it('disables Change while the order is locked', () => {
    const button: HTMLButtonElement = render(true).nativeElement.querySelector('button');
    expect(button.disabled).toBe(true);
  });
});
