import { Component, input, linkedSignal, output, computed } from '@angular/core';
import { form, required, min, max, disabled, FormField } from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import type { ClarificationLine } from '../../../../../../shared/contracts/draft';

@Component({
  imports: [FormField, MatFormFieldModule, MatSelectModule, MatInputModule, MatButtonModule],
  selector: 'app-clarification-input',
  styles: `
    :host {
      display: block;
    }
    mat-form-field {
      width: 100%;
    }
    .quantity {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .quantity mat-form-field {
      flex: 1;
      min-width: 0;
    }
    .quantity button {
      flex-shrink: 0;
      margin-bottom: 20px;
    }
    .quantity button[mat-stroked-button]:not(:disabled) {
      color: var(--ink);
    }
  `,
  template: `
    <mat-form-field appearance="outline"
      ><mat-label>Product for {{ line().originalWording }}</mat-label>
      <mat-select [formField]="fields.productId">
        @for (product of choices(); track product.productId) {
          <mat-option [value]="product.productId">{{ product.productName }}</mat-option>
        }
      </mat-select>
    </mat-form-field>
    <div class="quantity">
      <mat-form-field appearance="outline"
        ><mat-label>Quantity for {{ line().originalWording }}</mat-label>
        <input
          matInput
          type="number"
          step="1"
          inputmode="numeric"
          [formField]="fields.quantity"
        /> </mat-form-field
      ><button
        mat-stroked-button
        (click)="resolved.emit(model())"
        [disabled]="locked() || fields().invalid() || model().quantity % 1 !== 0"
      >
        Use selection
      </button>
    </div>
  `,
})
export class ClarificationInput {
  readonly line = input.required<ClarificationLine>();
  readonly products = input.required<{ productId: string; productName: string }[]>();
  readonly locked = input(false);
  readonly resolved = output<{ productId: string; quantity: number }>();
  readonly choices = computed(() =>
    this.line().candidates.length ? this.line().candidates : this.products(),
  );
  readonly model = linkedSignal(() => ({
    productId: this.line().candidates.length === 1 ? this.line().candidates[0].productId : '',
    quantity: this.line().quantity ?? 0,
  }));
  readonly fields = form(this.model, (p) => {
    required(p.productId);
    min(p.quantity, 1);
    max(p.quantity, 99);
    disabled(p, () => this.locked());
  });
}
