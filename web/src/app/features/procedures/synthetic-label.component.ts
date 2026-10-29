import { knowledgeProvenanceLabel } from '../../../../../shared/knowledge-metadata';
import { Component, input } from '@angular/core';
import type { DocumentSource } from '../../../../../shared/contracts/knowledge';

@Component({
  selector: 'app-synthetic-label',
  template: ` <span class="provenance">{{ label(source()) }}</span> `,
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
  readonly label = knowledgeProvenanceLabel;
  readonly source = input.required<DocumentSource>();
}
