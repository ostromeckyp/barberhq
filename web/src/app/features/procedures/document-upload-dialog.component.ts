import type {
  KnowledgeDocumentKind,
  KnowledgeOrigin,
} from '../../../../../shared/contracts/knowledge/index';
import { metadataFromLegacy } from '../../../../../shared/knowledge-metadata';
import { Component, effect, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DelayedLoadingDirective } from '../../shared/ui/delayed-loading/delayed-loading';
import { PdfDropzone } from '../../shared/ui/pdf-dropzone/pdf-dropzone';
import { DocumentUploadFacade } from './library/document-upload.facade';

@Component({
  selector: 'app-document-upload-dialog',
  providers: [DocumentUploadFacade],
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
    DelayedLoadingDirective,
    PdfDropzone,
  ],
  template: `
    <h2 mat-dialog-title>
      {{
        facade.data.resume
          ? 'Resume PDF upload'
          : facade.recoveredRegistration()
            ? 'Recover registration'
            : facade.data.replaceTarget
              ? 'Replace document PDF'
              : 'Add a new document'
      }}
    </h2>
    <mat-dialog-content>
      @if (!facade.data.resume) {
        @if (facade.data.replaceTarget; as target) {
          <p class="notice">
            This creates a new version for <strong>{{ target.title }}</strong> ({{
              target.version
            }}, document revision {{ target.documentRevision }}). A stale revision will be rejected;
            refresh the library and select Replace PDF again.
          </p>
        }
        <p>
          Upload a text-supported PDF. Maximum 10 MiB and 30 physical pages. Scanned PDFs and OCR
          are not supported.
        </p>
        @if (facade.unknownRegistration()) {
          <p class="notice" role="status">
            The unresolved registration is for
            <strong>{{ facade.recoveredRegistration()?.title }}</strong
            >. Choose that request’s same PDF and retry; its frozen details and idempotency key will
            be reused.
          </p>
        }
        <form [formGroup]="form">
          <mat-form-field appearance="outline"
            ><mat-label>Document title</mat-label
            ><input matInput formControlName="title" required />
            @if (form.controls.title.touched && form.controls.title.hasError('required')) {
              <mat-error>A title is required.</mat-error>
            }
            @if (form.controls.title.touched && form.controls.title.hasError('maxlength')) {
              <mat-error>Use 160 characters or fewer.</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline"
            ><mat-label>Language</mat-label
            ><mat-select formControlName="language"
              ><mat-option value="en">English</mat-option
              ><mat-option value="pl">Polish</mat-option></mat-select
            ></mat-form-field
          >
          <mat-form-field appearance="outline">
            <mat-label>Document kind</mat-label>
            <mat-select formControlName="kind">
              <mat-option value="procedure">Procedure</mat-option>
              <mat-option value="policy">Policy</mat-option>
              <mat-option value="product-card">Product card</mat-option>
              <mat-option value="product-catalog">Product catalog</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Origin</mat-label>
            <mat-select formControlName="origin">
              <mat-option value="synthetic">Synthetic demo</mat-option>
              <mat-option value="official">Official</mat-option>
              <mat-option value="public-compilation">Unofficial public compilation</mat-option>
            </mat-select>
          </mat-form-field>
          @if (form.controls.origin.value === 'public-compilation') {
            <mat-form-field appearance="outline"
              ><mat-label>Provenance URLs (one per line)</mat-label
              ><textarea matInput rows="3" formControlName="sourceUrls"></textarea>
            </mat-form-field>
            <mat-form-field appearance="outline"
              ><mat-label>Observed on</mat-label
              ><input matInput type="date" formControlName="observedOn"
            /></mat-form-field>
          }
        </form>
      } @else {
        <p>
          Choose the original PDF for {{ facade.data.resume.title }} ·
          {{ facade.data.resume.version }}. It must match the registered SHA-256 fingerprint.
        </p>
      }
      <app-pdf-dropzone
        [prompt]="facade.data.resume ? 'Select the matching PDF' : 'Drag a PDF here or browse'"
        [fileName]="facade.fileName()"
        [disabled]="facade.busy()"
        (filesSelected)="facade.selectFiles($event)"
      />
      @if (facade.registered()) {
        <p role="status">
          Version {{ facade.registered()!.versionId }} is registered. Uploading the matching
          original queues extraction; it does not publish the document.
        </p>
      }
      @if (facade.error()) {
        <p class="error" role="alert">{{ facade.error() }}</p>
      }
      <mat-progress-bar
        *appDelayedLoading="facade.busy()"
        mode="indeterminate"
        aria-label="Registering or uploading PDF"
      />
    </mat-dialog-content>
    <mat-dialog-actions align="end"
      ><button mat-button mat-dialog-close [disabled]="facade.busy()">Cancel</button
      ><button mat-flat-button [disabled]="facade.busy() || !facade.fileName()" (click)="submit()">
        {{ facade.submitLabel() }}
      </button></mat-dialog-actions
    >
  `,
  styles: [
    `
      mat-form-field {
        display: block;
        width: 100%;
      }
      .error,
      .notice {
        color: var(--warning-text);
        background: var(--warning-background);
        padding: 12px;
        border-radius: 8px;
      }
      p {
        line-height: 1.5;
        overflow-wrap: anywhere;
      }
      mat-dialog-actions {
        gap: 8px;
        flex-wrap: wrap;
      }
    `,
  ],
})
export class DocumentUploadDialogComponent {
  readonly facade = inject(DocumentUploadFacade);
  readonly form = new FormGroup({
    title: new FormControl(this.facade.data.replaceTarget?.title ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(160)],
    }),
    language: new FormControl<'en' | 'pl'>(
      this.facade.data.replaceTarget?.language === 'pl' ? 'pl' : 'en',
      { nonNullable: true },
    ),
    kind: new FormControl<KnowledgeDocumentKind>(
      this.facade.data.replaceTarget?.kind ?? 'procedure',
      { nonNullable: true },
    ),
    origin: new FormControl<KnowledgeOrigin>(
      this.facade.data.replaceTarget?.origin ?? 'synthetic',
      { nonNullable: true },
    ),
    sourceUrls: new FormControl(this.facade.data.replaceTarget?.sourceUrls?.join('\n') ?? '', {
      nonNullable: true,
    }),
    observedOn: new FormControl(this.facade.data.replaceTarget?.observedOn ?? '', {
      nonNullable: true,
    }),
  });
  constructor() {
    effect(() => {
      const pending = this.facade.recoveredRegistration();
      if (!pending) return;
      this.form.reset(
        {
          title: pending.title,
          language: pending.language,
          ...('sourceType' in pending
            ? metadataFromLegacy(pending.sourceType)
            : { kind: pending.kind, origin: pending.origin }),
          sourceUrls: pending.sourceUrls.join('\n'),
          observedOn: pending.observedOn ?? '',
        },
        { emitEvent: false },
      );
      this.form.disable({ emitEvent: false });
    });
  }
  submit(): void {
    if (!this.facade.data.resume && !this.facade.unknownRegistration() && !this.form.valid) {
      this.form.markAllAsTouched();
      return;
    }
    void this.facade.submit(this.form.getRawValue());
  }
}
