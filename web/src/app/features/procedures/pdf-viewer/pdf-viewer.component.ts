import { BackLink } from '../../../shared/ui/back-link/back-link';
import { TranslocoPipe } from '@jsverse/transloco';
import { provenanceKey } from '../provenance-key';
import { DelayedLoadingDirective } from '../../../shared/ui/delayed-loading/delayed-loading';
import { Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { PdfViewerFacade } from './pdf-viewer.facade';

@Component({
  selector: 'app-pdf-viewer',
  providers: [PdfViewerFacade],
  imports: [BackLink, MatIconModule, DelayedLoadingDirective, MatButtonModule, TranslocoPipe],
  templateUrl: './pdf-viewer.component.html',
  styleUrl: './pdf-viewer.component.scss',
})
export class PdfViewerComponent {
  readonly provenanceKey = provenanceKey;
  readonly facade = inject(PdfViewerFacade);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('pageCanvas');

  constructor() {
    effect(() => {
      const canvas = this.canvas()?.nativeElement;
      this.facade.renderToken();
      this.facade.page();
      this.facade.zoom();
      this.facade.rotation();
      if (canvas) void this.facade.render(canvas);
    });
  }
}
