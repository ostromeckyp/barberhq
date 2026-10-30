import { ProductKnowledgeReviewComponent } from './product-knowledge-review.component';
import { ProductKnowledgeReviewFacade } from './library/product-knowledge-review.facade';
import { MatDialog } from '@angular/material/dialog';
import { DocumentUploadDialogComponent } from './document-upload-dialog.component';
import { TranslocoPipe } from '@jsverse/transloco';
import { provenanceKey } from './provenance-key';
import { Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { DelayedLoadingDirective } from '../../shared/ui/delayed-loading/delayed-loading';
import { PdfRenderer } from './pdf-viewer/pdf-renderer';
import { DocumentReviewFacade } from './library/document-review.facade';
import { DOCUMENT_PDF_RENDERER } from './library/document-review-renderer';

@Component({
  selector: 'app-document-review',
  providers: [
    DocumentReviewFacade,
    ProductKnowledgeReviewFacade,
    { provide: DOCUMENT_PDF_RENDERER, useFactory: () => new PdfRenderer() },
  ],
  imports: [
    ProductKnowledgeReviewComponent,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    DelayedLoadingDirective,
    TranslocoPipe,
  ],
  templateUrl: './document-review.component.html',
  styleUrl: './document-review.component.scss',
})
export class DocumentReviewComponent {
  private readonly dialog = inject(MatDialog);
  replace(): void {
    const row = this.facade.review()?.version;
    if (!row) return;
    this.dialog.open(DocumentUploadDialogComponent, {
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
    });
  }
  readonly provenanceKey = provenanceKey;
  readonly facade = inject(DocumentReviewFacade);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('pageCanvas');

  constructor() {
    effect(() => {
      const canvas = this.canvas()?.nativeElement;
      this.facade.review();
      this.facade.pageNumber();
      if (canvas) void this.facade.render(canvas);
    });
  }
}
