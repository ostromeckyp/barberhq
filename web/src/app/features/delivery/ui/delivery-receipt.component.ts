import { Component, inject } from '@angular/core';
import { FormField, form, disabled, maxLength, applyEach, min, max } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DelayedLoadingDirective } from '../../../shared/ui/delayed-loading/delayed-loading';
import { DeliveryReceiptFacade } from '../feature/delivery-receipt.facade';
@Component({
  selector: 'app-delivery-receipt',
  providers: [DeliveryReceiptFacade],
  imports: [
    FormField,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    DelayedLoadingDirective,
  ],
  templateUrl: './delivery-receipt.component.html',
  styleUrl: './delivery-receipt.component.scss',
})
export class DeliveryReceiptComponent {
  readonly facade = inject(DeliveryReceiptFacade);
  readonly fields = form(this.facade.draft.model, (p) => {
    disabled(p, { when: () => this.facade.locked() });
    maxLength(p.description, 1000);
    maxLength(p.batchIdentifier, 120);
    applyEach(p.items, (item) => {
      for (const field of [item.goodQuantity, item.damagedQuantity, item.missingQuantity]) {
        min(field, 0);
        max(field, 99);
      }
    });
  });
  readonly labels = { DAMAGED: 'damaged product', MISSING: 'missing product' };
}
