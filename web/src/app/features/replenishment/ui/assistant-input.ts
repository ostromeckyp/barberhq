import { Component, computed, inject } from '@angular/core';
import { form, required, maxLength, disabled, FormField } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ReplenishmentAssistantFacade } from '../feature/replenishment-assistant.facade';
import { OrderFacade } from '../feature/order.facade';
import { DictationFacade } from '../feature/dictation.facade';
import { DictationButton } from './dictation-button';

@Component({
  imports: [
    FormField,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
    DictationButton,
  ],
  providers: [DictationFacade],
  selector: 'app-assistant-input',
  styles: `
    :host {
      display: block;
      margin-top: 20px;
    }
    mat-form-field {
      width: 100%;
      margin-bottom: 8px;
    }
    p {
      font-size: 13px;
      line-height: 1.5;
    }
    .examples {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0 0 12px;
    }
    .examples button {
      border-radius: 8px;
      min-height: 32px;
      padding-inline: 10px;
      font-size: 13px;
    }
    button[mat-stroked-button]:not(:disabled) {
      color: var(--ink);
    }
    a {
      display: block;
      margin: 12px 0;
      color: var(--ink);
    }
    .error {
      color: var(--error, #8c1d18);
    }
  `,
  template: `
    <mat-form-field appearance="outline" subscriptSizing="dynamic">
      <mat-label>{{ 'replenishment.assistant.label' | transloco }}</mat-label>
      <textarea
        matInput
        rows="3"
        [formField]="fields"
        [placeholder]="'replenishment.assistant.placeholder' | transloco"
      ></textarea>
    </mat-form-field>
    <app-dictation-button />
    <div
      class="examples"
      role="group"
      [attr.aria-label]="'replenishment.assistant.examples.label' | transloco"
    >
      <button
        mat-stroked-button
        type="button"
        (click)="useExample(singleExample())"
        [disabled]="!singleExample() || facade.loading() || order.locked()"
      >
        <mat-icon aria-hidden="true">format_quote</mat-icon
        >{{ 'replenishment.assistant.examples.single' | transloco }}
      </button>
      <button
        mat-stroked-button
        type="button"
        (click)="useExample(severalExample())"
        [disabled]="!severalExample() || facade.loading() || order.locked()"
      >
        <mat-icon aria-hidden="true">format_list_bulleted</mat-icon
        >{{ 'replenishment.assistant.examples.several' | transloco }}
      </button>
    </div>
    <button
      mat-flat-button
      type="button"
      (click)="facade.prepare()"
      [disabled]="!facade.canPrepare() || fields().invalid()"
    >
      <mat-icon aria-hidden="true">auto_awesome</mat-icon>
      {{
        (facade.loading() ? 'replenishment.assistant.preparing' : 'replenishment.assistant.prepare')
          | transloco
      }}
    </button>
    @if (facade.error(); as error) {
      <p class="error" role="alert">{{ error.key | transloco: error.params }}</p>
    }
    @if (facade.notice(); as notice) {
      <p role="status">{{ notice.key | transloco: notice.params }}</p>
    }
    @if (facade.shorthandNotice(); as notice) {
      <p role="status">{{ notice.key | transloco: notice.params }}</p>
    }
    @for (item of facade.excluded(); track item.productId) {
      <a [routerLink]="['/salons', order.salonId(), 'requests', item.requestId]">{{
        'replenishment.assistant.alreadyRequested' | transloco
      }}</a>
    }
  `,
})
export class AssistantInput {
  readonly facade = inject(ReplenishmentAssistantFacade);
  readonly order = inject(OrderFacade);
  readonly singleExample = computed(() => {
    const first = this.order.inventory.rows()[0];
    return first ? `2 ${first.productName}` : '';
  });
  readonly severalExample = computed(() =>
    this.order.inventory
      .rows()
      .slice(0, 3)
      .map((row, index) => `${[2, 3, 1][index]} ${row.productName}`)
      .join(', '),
  );
  readonly fields = form(this.facade.message, (p) => {
    required(p);
    maxLength(p, 2000);
    disabled(p, () => this.facade.loading() || this.order.locked());
  });
  useExample(message: string): void {
    if (!message || this.facade.loading() || this.order.locked()) return;
    this.facade.message.set(message);
  }
}
