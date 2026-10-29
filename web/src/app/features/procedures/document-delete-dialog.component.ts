import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import type { DocumentRow } from '../../../../../shared/contracts/knowledge';

@Component({
  selector: 'app-document-delete-dialog',
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>Withdraw {{ row.title }} · {{ row.version }}</h2>
    <mat-dialog-content>
      <p>This revokes access to the selected version.</p>
      <p>Private originals and audit records are retained.</p>
      @if (!row.superseded && row.publishedAt) {
        <p>Withdrawing the current version does not restore an older version.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button [mat-dialog-close]="true">Withdraw version</button>
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
