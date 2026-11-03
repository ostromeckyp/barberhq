import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import type { ReadyDraftLine } from '../../../../../../shared/contracts/draft/index';
import { DraftStore } from '../feature/draft.store';
import { OrderFacade } from '../feature/order.facade';
import { ReplenishmentAssistantFacade } from '../feature/replenishment-assistant.facade';
import { OrderPanel } from './order-panel';

const ready = (lineId: string, extra: Partial<ReadyDraftLine> = {}): ReadyDraftLine => ({
  status: 'READY',
  lineId,
  productId: lineId,
  productName: `Product ${lineId}`,
  quantity: 2,
  origin: 'assistant',
  hqAvailable: 10,
  salonOnHand: 1,
  hqInventoryVersion: 1,
  salonInventoryVersion: 1,
  ...extra,
});
function render(lines: ReadyDraftLine[]) {
  const changed: string[] = [];
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      DraftStore,
      {
        provide: OrderFacade,
        useFactory: () => ({
          draft: TestBed.inject(DraftStore),
          manual: signal({ productId: '', quantity: 2 }),
          locked: signal(false),
          notice: signal(null),
          canSubmit: () => false,
          outcome: () => undefined,
          salonId: () => 'salon',
          savedSalonName: () => undefined,
          pendingElsewhere: () => false,
          activeFor: () => undefined,
          inventory: { rows: () => [] },
          submission: {
            pending: () => false,
            blocked: () => '',
            busy: () => false,
            error: () => null,
            savedSalonId: () => undefined,
          },
        }),
      },
      {
        provide: ReplenishmentAssistantFacade,
        useValue: { loading: () => false, changeMatch: (id: string) => changed.push(id) },
      },
    ],
  });
  for (const line of lines) TestBed.inject(DraftStore).add(line);
  const fixture = TestBed.createComponent(OrderPanel);
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, changed };
}

describe('OrderPanel AI match', () => {
  it('labels only AI-matched lines and sends Change to the assistant', () => {
    const { el, changed } = render([
      ready('plain'),
      ready('ai', {
        aiMatch: { originalWording: 'matte', reason: 'Closest name', alternatives: [] },
      }),
    ]);
    const [plain, ai] = Array.from(el.querySelectorAll('article.draft-line'));
    expect(plain.querySelector('app-ai-match-note')).toBeNull();
    expect(plain.textContent).not.toContain('Matched by AI');
    expect(ai.textContent).toContain('Matched by AI');
    expect(ai.textContent).toContain('Closest name');
    (ai.querySelector('app-ai-match-note button') as HTMLButtonElement).click();
    expect(changed).toEqual(['ai']);
  });
});
