import { TranslocoPipe } from '@jsverse/transloco';
import { Component, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { DelayedLoadingDirective } from '../../shared/ui/delayed-loading/delayed-loading';
import { runtimeConfig } from '../../core/public-config';
import { DocumentLibraryFacade } from './library/document-library.facade';
import { DocumentRowComponent } from './document-row.component';
import { DocumentDeleteDialogComponent } from './document-delete-dialog.component';
import { DocumentUploadDialogComponent } from './document-upload-dialog.component';
import type { DocumentRow } from '../../../../../shared/contracts/knowledge/index';

@Component({
  selector: 'app-document-library',
  providers: [DocumentLibraryFacade],
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    DelayedLoadingDirective,
    DocumentRowComponent,
    TranslocoPipe,
  ],
  templateUrl: './document-library.component.html',
  styleUrl: './document-library.component.scss',
})
export class DocumentLibraryComponent {
  readonly embedded = input(false);
  readonly facade = inject(DocumentLibraryFacade);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  readonly enabled = () => runtimeConfig.publicConfig?.knowledgeEnabled === true;

  add(): void {
    this.dialog
      .open(DocumentUploadDialogComponent, {
        width: 'min(620px, calc(100vw - 24px))',
        maxHeight: '90vh',
        data: {},
      })
      .afterClosed()
      .subscribe((status) => {
        if (status) this.facade.refresh();
      });
  }

  resume(row: DocumentRow): void {
    this.dialog
      .open(DocumentUploadDialogComponent, {
        width: 'min(620px, calc(100vw - 24px))',
        maxHeight: '90vh',
        data: { resume: row },
      })
      .afterClosed()
      .subscribe((status) => {
        if (status) this.facade.refresh();
      });
  }

  replace(row: DocumentRow): void {
    this.dialog
      .open(DocumentUploadDialogComponent, {
        width: 'min(620px, calc(100vw - 24px))',
        maxHeight: '90vh',
        data: {
          replaceTarget: {
            documentId: row.documentId,
            documentRevision: row.documentRevision,
            title: row.title,
            version: row.version,
            kind: row.kind,
            origin: row.origin,
            language: row.language,
            sourceUrls: row.sourceUrls,
            observedOn: row.observedOn,
          },
        },
      })
      .afterClosed()
      .subscribe((status) => {
        if (status) this.facade.refresh();
      });
  }

  withdraw(row: DocumentRow): void {
    this.dialog
      .open(DocumentDeleteDialogComponent, {
        width: 'min(480px, calc(100vw - 24px))',
        data: row,
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) void this.facade.withdraw(row);
      });
  }

  openPdf(row: DocumentRow): void {
    void this.router.navigate(['/procedures/sources', row.versionId]);
  }

  reviewUrl(row: DocumentRow): string[] {
    return ['/procedures/review', row.versionId];
  }
  retry(row: DocumentRow): void {
    void this.facade.retry(row);
  }
}
