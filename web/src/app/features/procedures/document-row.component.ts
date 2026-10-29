import { knowledgeProvenanceLabel } from '../../../../../shared/knowledge-metadata';
import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { DocumentRow } from '../../../../../shared/contracts/knowledge/index';

@Component({
  selector: 'app-document-row',
  imports: [DatePipe, MatButtonModule, MatIconModule],
  template: `
    <article class="document-row">
      <div class="identity">
        <mat-icon class="pdf-icon" aria-hidden="true">picture_as_pdf</mat-icon>
        <div class="document-name">
          <h3>{{ row().title }}</h3>
          <div class="labels">
            <span class="label synthetic">{{ provenanceLabel(row()) }}</span>
            @if (row().revokedAt) {
              <span class="label withdrawn">Withdrawn</span>
            } @else if (row().superseded) {
              <span class="label">Superseded</span>
            } @else if (row().publishedAt) {
              <span class="label current">Current</span>
            } @else {
              <span class="label">{{ statusLabel() }}</span>
            }
          </div>
        </div>
      </div>
      <dl class="metadata">
        <div>
          <dt>Version</dt>
          <dd>{{ row().version }}</dd>
        </div>
        <div>
          <dt>Pages</dt>
          <dd>{{ row().pageCount ?? '—' }}</dd>
        </div>
        <div class="date">
          <dt>{{ row().publishedAt ? 'Published' : 'Added' }}</dt>
          <dd>{{ row().publishedAt || row().createdAt | date: 'd MMM y' : 'UTC' }}</dd>
        </div>
      </dl>
      <ng-content />
    </article>
  `,
  styles: [
    `
      .document-row {
        display: grid;
        grid-template-columns: var(
          --document-library-columns,
          minmax(0, 1.6fr) minmax(180px, 1fr) minmax(0, 2fr)
        );
        align-items: center;
        gap: 18px;
        padding: 17px 18px;
        border-bottom: 1px solid var(--border);
        background: var(--surface);
      }
      .identity {
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }
      .pdf-icon {
        color: var(--brand);
        flex-shrink: 0;
      }
      .document-name {
        min-width: 0;
      }
      .identity,
      .labels {
        min-width: 0;
      }
      h3 {
        margin: 0 0 5px;
        font-size: 15px;
        line-height: 1.35;
      }
      p {
        margin: 0;
        color: var(--muted);
        font-size: 13px;
        overflow-wrap: anywhere;
      }
      .metadata {
        display: flex;
        flex-wrap: wrap;
        gap: 12px 18px;
        margin: 0;
        font-size: 12px;
        color: var(--muted);
      }
      dt {
        margin-bottom: 3px;
      }
      dd {
        margin: 0;
        color: var(--ink);
        font: 600 14px var(--font-mono);
        overflow-wrap: anywhere;
      }
      .date dd {
        font:
          500 13px 'Archivo Variable',
          sans-serif;
      }
      .labels {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
      }
      .label {
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 5px 9px;
        font-size: 12px;
      }
      .synthetic {
        background: var(--warning-background);
        color: var(--warning-text);
      }
      .current {
        color: var(--ink);
        border-color: var(--ink);
        font-weight: 700;
      }
      .withdrawn {
        color: var(--muted);
        text-decoration: line-through;
      }
      @container document-library (max-width: 900px) {
        .document-row {
          grid-template-columns: minmax(0, 1fr);
          align-items: stretch;
          gap: 10px;
          padding: 15px;
        }
      }
    `,
  ],
})
export class DocumentRowComponent {
  readonly provenanceLabel = knowledgeProvenanceLabel;
  readonly row = input.required<DocumentRow>();
  statusLabel(): string {
    const row = this.row();
    if (row.status === 'STAGED')
      return row.pendingStage === 'EXTRACT' ? 'Staged · upload/extraction pending' : 'Staged';
    if (row.status === 'EXTRACTED') return 'Review required';
    if (row.status === 'NEEDS_REVIEW') return 'Needs review';
    if (row.status === 'FAILED') return 'Failed';
    return row.status.replaceAll('_', ' ').toLowerCase();
  }
}
