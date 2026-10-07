import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
@Component({
  selector: 'app-empty-state',
  imports: [MatIconModule],
  template: `<section class="empty">
    <mat-icon>{{ icon() }}</mat-icon>
    <h2>{{ title() }}</h2>
    <p>{{ message() }}</p>
    <ng-content />
  </section>`,
  styles: `
    .empty {
      text-align: center;
      padding: 48px 20px;
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      background: var(--surface);
    }
    .empty > mat-icon {
      color: var(--muted);
      width: 40px;
      height: 40px;
      font-size: 40px;
    }
    h2 {
      font-size: 20px;
    }
    p {
      color: var(--muted);
      max-width: 440px;
      margin: 12px auto 20px;
    }
  `,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly icon = input('inventory_2');
}
