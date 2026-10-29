import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expect, it } from 'vitest';
import { AssistantInput } from './assistant-input';
import { AssistantApi } from '../../../core/assistant-api';
import { SessionFacade } from '../../auth/feature/session.facade';
import { OrderFacade } from '../feature/order.facade';
import { DraftStore } from '../feature/draft.store';
import { ReplenishmentAssistantFacade } from '../feature/replenishment-assistant.facade';
it('prepares an editable draft from the visible form without submitting a request', async () => {
  TestBed.configureTestingModule({
    imports: [AssistantInput],
    providers: [
      DraftStore,
      ReplenishmentAssistantFacade,
      {
        provide: AssistantApi,
        useValue: {
          prepareReplenishment: async () => ({
            status: 'PROPOSAL',
            lines: [
              {
                status: 'READY',
                lineId: 'line-0-8',
                productId: 'matowa',
                productName: 'Matowa',
                quantity: 2,
                origin: 'assistant',
                hqAvailable: 18,
                salonOnHand: 2,
                hqInventoryVersion: 1,
                salonInventoryVersion: 1,
              },
            ],
            excluded: [],
            toolEvents: [],
          }),
        },
      },
      {
        provide: SessionFacade,
        useValue: {
          state: signal({ status: 'READY', membership: { userId: 'user', businessId: 'b' } }),
        },
      },
      {
        provide: OrderFacade,
        useValue: { salonId: () => 'salon', locked: () => false, canOrder: () => true,
          inventory: {rows: signal([{productName:'Matowa'}])} },
      },
    ],
  });
  const fixture = TestBed.createComponent(AssistantInput);
  fixture.detectChanges();
  const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('textarea');
  expect(textarea).not.toBeNull();
  textarea.value = '2 Matowa';
  textarea.dispatchEvent(new Event('input'));
  fixture.detectChanges();
  const button = Array.from(
    fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
  ).find((b) => b.textContent?.includes('Prepare proposal'))!;
  button.click();
  await fixture.whenStable();
  fixture.detectChanges();
  expect(TestBed.inject(DraftStore).lines()[0]).toMatchObject({
    productId: 'matowa',
    quantity: 2,
    origin: 'assistant',
  });
  expect(fixture.nativeElement.textContent).toContain('Review quantities');
});
