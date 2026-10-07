import { Component, input } from '@angular/core';
@Component({
  selector: 'app-page-header',
  template: `<header>
    <div>
      <p class="eyebrow">{{ eyebrow() }}</p>
      <h1>{{ title() }}</h1>
      <p class="description">{{ description() }}</p>
    </div>
    <div class="actions"><ng-content /></div>
  </header>`,
  styles: `
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
    }
    .description {
      margin: 0;
      color: var(--muted);
    }
    .actions {
      flex-shrink: 0;
    }
    @media (max-width: 500px) {
      header {
        align-items: flex-start;
        flex-wrap: wrap;
      }
    }
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly eyebrow = input('');
  readonly description = input('');
}
