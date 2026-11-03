import { Component, input, linkedSignal, output, computed } from '@angular/core';
import { form, required, min, max, disabled, FormField } from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoPipe } from '@jsverse/transloco';
import type { ClarificationLine } from '../../../../../../shared/contracts/draft/index';

type Choice = ClarificationLine['candidates'][number];

@Component({
  imports: [
    FormField,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    TranslocoPipe,
  ],
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
    .suggested {
      margin-inline-start: 8px;
      font-weight: 600;
      color: var(--ink);
    }
    .suggested-reason {
      display: block;
      color: var(--muted);
    }
  `,
  template: `
    <mat-form-field appearance="outline"
      ><mat-label>{{
        'replenishment.clarify.product' | transloco: { wording: line().originalWording }
      }}</mat-label>
      <mat-select [formField]="fields.productId">
        <mat-select-trigger>{{ selectedName() }}</mat-select-trigger>
        @for (product of choices(); track product.productId) {
          <mat-option [value]="product.productId"
            >{{ product.productName }}
            @if (product.suggested) {
              <span class="suggested">{{
                'replenishment.order.aiMatch.suggested' | transloco
              }}</span>
              @if (product.reason) {
                <small class="suggested-reason">{{ product.reason }}</small>
              }
            }
          </mat-option>
        }
      </mat-select>
    </mat-form-field>
    <div class="quantity">
      <mat-form-field appearance="outline"
        ><mat-label>{{
          'replenishment.clarify.quantity' | transloco: { wording: line().originalWording }
        }}</mat-label>
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
        {{ 'replenishment.clarify.use' | transloco }}
      </button>
    </div>
  `,
})
export class ClarificationInput {
  readonly line = input.required<ClarificationLine>();
  readonly products = input.required<{ productId: string; productName: string }[]>();
  readonly locked = input(false);
  readonly resolved = output<{ productId: string; quantity: number }>();
  /** Candidates (AI suggestions first), or the whole catalog when there are none. */
  readonly choices = computed<Choice[]>(() => {
    const { candidates } = this.line();
    return candidates.length
      ? [...candidates.filter((c) => c.suggested), ...candidates.filter((c) => !c.suggested)]
      : this.products();
  });
  readonly model = linkedSignal(() => {
    const line = this.line(),
      first = this.choices()[0];
    // A quantity question about an AI suggestion is answered for that product.
    const preset =
      line.candidates.length === 1 || (line.reasonCode === 'ENTER_QUANTITY' && first?.suggested);
    return { productId: preset ? first.productId : '', quantity: line.quantity ?? 0 };
  });
  readonly selectedName = computed(
    () => this.choices().find((c) => c.productId === this.model().productId)?.productName ?? '',
  );
  readonly fields = form(this.model, (p) => {
    required(p.productId);
    min(p.quantity, 1);
    max(p.quantity, 99);
    disabled(p, () => this.locked());
  });
}
