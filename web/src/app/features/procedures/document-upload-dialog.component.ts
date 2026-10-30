import type {
  KnowledgeDocumentKind,
  KnowledgeOrigin,
} from '../../../../../shared/contracts/knowledge/index';
import { metadataFromLegacy } from '../../../../../shared/knowledge-metadata';
import { TranslocoPipe } from '@jsverse/transloco';
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
    TranslocoPipe,
  ],
  template: `
    <h2 mat-dialog-title>
      {{ titleKey() | transloco }}
    </h2>
    <mat-dialog-content>
      @if (!facade.data.resume) {
        @if (facade.data.replaceTarget; as target) {
          <p class="notice">
            {{ 'procedures.upload.replaceBefore' | transloco }}
            <strong>{{ target.title }}</strong>
            {{
              'procedures.upload.replaceAfter'
                | transloco: { version: target.version, revision: target.documentRevision }
            }}
          </p>
        }
        <p>{{ 'procedures.upload.intro' | transloco }}</p>
        @if (facade.unknownRegistration()) {
          <p class="notice" role="status">
            {{ 'procedures.upload.unresolved' | transloco }}
            <strong>{{ facade.recoveredRegistration()?.title }}</strong
            >{{ 'procedures.upload.unresolvedRetry' | transloco }}
          </p>
        }
        <form [formGroup]="form">
          <mat-form-field appearance="outline"
            ><mat-label>{{ 'procedures.upload.fields.title' | transloco }}</mat-label
            ><input matInput formControlName="title" required />
            @if (form.controls.title.touched && form.controls.title.hasError('required')) {
              <mat-error>{{ 'procedures.upload.fields.titleRequired' | transloco }}</mat-error>
            }
            @if (form.controls.title.touched && form.controls.title.hasError('maxlength')) {
              <mat-error>{{ 'procedures.upload.fields.titleLength' | transloco }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline"
            ><mat-label>{{ 'procedures.upload.fields.language' | transloco }}</mat-label
            ><mat-select formControlName="language"
              ><mat-option value="en">{{ 'procedures.language.en' | transloco }}</mat-option
              ><mat-option value="pl">{{
                'procedures.language.pl' | transloco
              }}</mat-option></mat-select
            ></mat-form-field
          >
          <mat-form-field appearance="outline">
            <mat-label>{{ 'procedures.upload.fields.kind' | transloco }}</mat-label>
            <mat-select formControlName="kind">
              <mat-option value="procedure">{{
                'procedures.kind.procedure' | transloco
              }}</mat-option>
              <mat-option value="policy">{{ 'procedures.kind.policy' | transloco }}</mat-option>
              <mat-option value="product-card">{{
                'procedures.kind.productCard' | transloco
              }}</mat-option>
              <mat-option value="product-catalog">
                {{ 'procedures.kind.productCatalog' | transloco }}
              </mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'procedures.upload.fields.origin' | transloco }}</mat-label>
            <mat-select formControlName="origin">
              <mat-option value="synthetic">{{
                'procedures.origin.synthetic' | transloco
              }}</mat-option>
              <mat-option value="official">{{
                'procedures.origin.official' | transloco
              }}</mat-option>
              <mat-option value="public-compilation">
                {{ 'procedures.origin.publicCompilation' | transloco }}
              </mat-option>
            </mat-select>
          </mat-form-field>
          @if (form.controls.origin.value === 'public-compilation') {
            <mat-form-field appearance="outline"
              ><mat-label>{{ 'procedures.upload.fields.urls' | transloco }}</mat-label
              ><textarea matInput rows="3" formControlName="sourceUrls"></textarea>
            </mat-form-field>
            <mat-form-field appearance="outline"
              ><mat-label>{{ 'procedures.upload.fields.observedOn' | transloco }}</mat-label
              ><input matInput type="date" formControlName="observedOn"
            /></mat-form-field>
          }
        </form>
      } @else {
        <p>
          {{
            'procedures.upload.resumeIntro'
              | transloco: { title: facade.data.resume.title, version: facade.data.resume.version }
          }}
        </p>
      }
      <app-pdf-dropzone
        [prompt]="facade.data.resume ? ('procedures.upload.matchingPdf' | transloco) : ''"
        [fileName]="facade.fileName()"
        [disabled]="facade.busy()"
        (filesSelected)="facade.selectFiles($event)"
      />
      @if (facade.registered()) {
        <p role="status">
          {{ 'procedures.upload.registered' | transloco: { id: facade.registered()!.versionId } }}
        </p>
      }
      @if (facade.error(); as error) {
        <p class="error" role="alert">{{ error.key | transloco: error.params }}</p>
      }
      <mat-progress-bar
        *appDelayedLoading="facade.busy()"
        mode="indeterminate"
        [attr.aria-label]="'procedures.upload.progress' | transloco"
      />
    </mat-dialog-content>
    <mat-dialog-actions align="end"
      ><button mat-button mat-dialog-close [disabled]="facade.busy()">
        {{ 'common.actions.cancel' | transloco }}</button
      ><button mat-flat-button [disabled]="facade.busy() || !facade.fileName()" (click)="submit()">
        {{ facade.submitLabelKey() | transloco }}
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
  titleKey(): string {
    if (this.facade.data.resume) return 'procedures.upload.title.resume';
    if (this.facade.recoveredRegistration()) return 'procedures.upload.title.recover';
    return this.facade.data.replaceTarget
      ? 'procedures.upload.title.replace'
      : 'procedures.upload.title.add';
  }
  submit(): void {
    if (!this.facade.data.resume && !this.facade.unknownRegistration() && !this.form.valid) {
      this.form.markAllAsTouched();
      return;
    }
    void this.facade.submit(this.form.getRawValue());
  }
}
