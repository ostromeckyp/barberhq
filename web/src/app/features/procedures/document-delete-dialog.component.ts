import { TranslocoPipe } from '@jsverse/transloco';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import type { DocumentRow } from '../../../../../shared/contracts/knowledge/index';

@Component({
  selector: 'app-document-delete-dialog',
  imports: [MatButtonModule, MatDialogModule, TranslocoPipe],
  template: `
    <h2 mat-dialog-title>
      {{ 'procedures.withdraw.title' | transloco: { title: row.title, version: row.version } }}
    </h2>
    <mat-dialog-content>
      <p>{{ 'procedures.withdraw.revokes' | transloco }}</p>
      <p>{{ 'procedures.withdraw.retained' | transloco }}</p>
      @if (!row.superseded && row.publishedAt) {
        <p>{{ 'procedures.withdraw.noRestore' | transloco }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'common.actions.cancel' | transloco }}</button>
      <button mat-flat-button [mat-dialog-close]="true">
        {{ 'procedures.withdraw.confirm' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      p {
        line-height: 1.5;
      }
      mat-dialog-actions {
        gap: 8px;
        flex-wrap: wrap;
      }
    `,
  ],
})
export class DocumentDeleteDialogComponent {
  readonly row = inject<DocumentRow>(MAT_DIALOG_DATA);
  readonly dialog = inject(MatDialogRef<DocumentDeleteDialogComponent, boolean>);
}
