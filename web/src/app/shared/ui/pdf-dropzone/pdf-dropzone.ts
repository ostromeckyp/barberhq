import { Component, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoPipe } from '@jsverse/transloco';

/** Drag-and-drop or browse picker for one PDF; the owner validates and uploads the file. */
@Component({
  selector: 'app-pdf-dropzone',
  imports: [MatButtonModule, TranslocoPipe],
  template: `
    <div
      class="pdf-dropzone"
      data-testid="pdf-dropzone"
      [class.dragging]="dragging()"
      [class.disabled]="disabled()"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
    >
      <p>{{ prompt() || ('common.pdfDropzone.prompt' | transloco) }}</p>
      <button mat-stroked-button type="button" [disabled]="disabled()" (click)="fileInput.click()">
        {{ 'common.pdfDropzone.browse' | transloco }}
      </button>
      <input
        #fileInput
        class="visually-hidden"
        type="file"
        accept="application/pdf,.pdf"
        [attr.aria-label]="label() || ('common.pdfDropzone.label' | transloco)"
        tabindex="-1"
        [disabled]="disabled()"
        (change)="onFileInputChange($event)"
      />
      @if (fileName()) {
        <p class="selected-file" aria-live="polite">
          {{ 'common.pdfDropzone.selected' | transloco: { name: fileName() } }}
        </p>
      }
    </div>
  `,
  styles: `
    .pdf-dropzone {
      border: 1px dashed var(--outline, #777);
      border-radius: 12px;
      padding: 16px;
      margin: 16px 0;
      text-align: center;
    }
    .pdf-dropzone.dragging {
      border-style: solid;
      background: var(--surface-container-high, #f3f3f3);
    }
    .pdf-dropzone.disabled {
      opacity: 0.65;
    }
    .selected-file {
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `,
})
export class PdfDropzone {
  /** Already translated text; empty shows the default prompt and label. */
  readonly prompt = input('');
  readonly label = input('');
  readonly fileName = input('');
  readonly disabled = input(false);
  readonly filesSelected = output<FileList>();
  readonly dragging = signal(false);
  onFileInputChange(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    if (input.files) this.filesSelected.emit(input.files);
    input.value = '';
  }
  onDragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    if (this.disabled()) return;
    this.dragging.set(true);
  }
  onDragLeave(event: DragEvent): void {
    if (
      event.relatedTarget &&
      (event.currentTarget as HTMLElement).contains(event.relatedTarget as Node)
    )
      return;
    this.dragging.set(false);
  }
  onDrop(event: DragEvent): void {
    this.dragging.set(false);
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    if (this.disabled()) return;
    this.filesSelected.emit(event.dataTransfer.files);
  }
}
