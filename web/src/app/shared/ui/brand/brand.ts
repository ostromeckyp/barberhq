import { Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
@Component({
  selector: 'app-brand',
  imports: [TranslocoPipe],
  host: { '[class.large]': 'large()', '[class.inverse]': 'inverse()' },
  template: `<strong>{{ 'common.brand.name' | transloco }}</strong
    ><span>{{ 'common.brand.demo' | transloco }}</span>`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--ink);
      white-space: nowrap;
    }
    strong {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.04em;
    }
    span {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 500;
      padding: 2px 6px;
      border: 1px solid var(--chip-border);
      border-radius: 4px;
    }
    :host.inverse {
      color: var(--surface);
    }
    :host.inverse span {
      border-color: var(--muted);
    }
    :host.large strong {
      font-size: 28px;
    }
  `,
})
export class Brand {
  readonly large = input(false);
  readonly inverse = input(false);
}
