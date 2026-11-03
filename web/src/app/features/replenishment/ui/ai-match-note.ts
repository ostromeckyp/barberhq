import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import type { AiMatch } from '../../../../../../shared/contracts/draft/index';

/** Label, model reason and "Change" action for a draft line whose product the AI chose. */
@Component({
  selector: 'app-ai-match-note',
  imports: [MatButtonModule, MatIconModule, TranslocoPipe],
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 8px;
      margin-top: 8px;
    }
    .label {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border: 1px solid var(--chip-border);
      border-radius: 999px;
      font: 600 12px var(--font-mono);
      color: var(--ink);
    }
    .label mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
    }
    .reason {
      flex: 1 1 12rem;
      min-width: 0;
      color: var(--muted);
    }
    button:not(:disabled) {
      color: var(--ink);
    }
  `,
  template: `
    <span class="label"
      ><mat-icon aria-hidden="true">auto_awesome</mat-icon
      >{{ 'replenishment.order.aiMatch.label' | transloco }}</span
    >
    <small class="reason">{{ match().reason }}</small>
    <button
      mat-button
      type="button"
      [disabled]="locked()"
      [attr.aria-label]="
        'replenishment.order.aiMatch.changeFor' | transloco: { name: productName() }
      "
      (click)="change.emit()"
    >
      {{ 'replenishment.order.aiMatch.change' | transloco }}
    </button>
  `,
})
export class AiMatchNote {
  readonly match = input.required<AiMatch>();
  readonly productName = input.required<string>();
  readonly locked = input(false);
  readonly change = output<void>();
}
