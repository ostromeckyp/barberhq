import { Component, inject, input } from '@angular/core';
import { form, required, min, max, FormField, disabled } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { NgTemplateOutlet } from '@angular/common';
import { OrderFacade } from '../feature/order.facade';
import { ReplenishmentAssistantFacade } from '../feature/replenishment-assistant.facade';
import { AssistantInput } from './assistant-input';
import { ClarificationInput } from './clarification-input';
import { runtimeConfig } from '../../../core/public-config';
@Component({
  selector: 'app-order-panel',
  imports: [
    FormField,
    RouterLink,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    NgTemplateOutlet,
    AssistantInput,
    ClarificationInput,
  ],
  templateUrl: './order-panel.html',
  styleUrl: './order-panel.scss',
})
export class OrderPanel {
  readonly facade = inject(OrderFacade);
  readonly assistant = inject(ReplenishmentAssistantFacade);
  readonly assistantEnabled = runtimeConfig.publicConfig?.replenishmentAiEnabled ?? false;
  readonly embedded = input(false);
  readonly fields = form(this.facade.manual, (p) => {
    disabled(p, () => this.facade.locked());
    required(p.productId);
    min(p.quantity, 1);
    max(p.quantity, 99);
  });
  quantity(event: Event, lineId: string) {
    this.facade.draft.editQuantity(lineId, (event.target as HTMLInputElement).valueAsNumber);
  }
}
