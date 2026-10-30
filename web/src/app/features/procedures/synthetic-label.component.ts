import { TranslocoPipe } from '@jsverse/transloco';
import { provenanceKey } from './provenance-key';
import { Component, input } from '@angular/core';
import type { DocumentSource } from '../../../../../shared/contracts/knowledge/index';

@Component({
  selector: 'app-synthetic-label',
  imports: [TranslocoPipe],
  template: ` <span class="provenance">{{ provenanceKey(source()) | transloco }}</span> `,
  styles: [
    `
      .provenance {
        display: inline-block;
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 4px 8px;
        background: var(--warning-background);
        color: var(--warning-text);
        font-size: 12px;
      }
    `,
  ],
})
export class SyntheticLabelComponent {
  readonly provenanceKey = provenanceKey;
  readonly source = input.required<DocumentSource>();
}
