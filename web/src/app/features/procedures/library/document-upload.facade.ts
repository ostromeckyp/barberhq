import { DestroyRef, Service, effect, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import type {
  CreateDocumentRequest,
  DocumentRow,
  VersionStatus,
} from '../../../../../../shared/contracts/knowledge/index';
import type { TranslatedText } from '../../../core/models/translated-text';
import { TranslatedError, translatedErrorText } from '../translated-error';
import { KnowledgeApi } from '../../../core/knowledge-api';
import { SalonContext } from '../../../core/salon-context';
import { SessionFacade } from '../../auth/feature/session.facade';
import type { UploadDialogData } from '../models/upload-dialog-data';
import type { UploadFormValue } from '../models/upload-form-value';
import {
  clearPendingUpload,
  clearScopeStorage,
  isRecoverableForTarget,
  isValidRegistration,
  matchesUploadTarget,
  persistPendingRegistration,
  persistPendingUpload,
  removePendingRegistration,
  uploadTargetStorageKey,
} from './document-upload-storage';

@Service({ autoProvided: false })
export class DocumentUploadFacade {
  readonly data = inject<UploadDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(KnowledgeApi);
  private readonly ref = inject(MatDialogRef<unknown, VersionStatus>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly session = inject(SessionFacade);
  private readonly context = inject(SalonContext);
  readonly busy = signal(false);
  readonly fileName = signal('');
  readonly error = signal<TranslatedText | null>(null);
  readonly registered = signal<DocumentRow | VersionStatus | null>(this.data.resume ?? null);
  readonly unknownRegistration = signal(false);
  readonly recoveredRegistration = signal<CreateDocumentRequest | null>(null);
  private file?: File;
  private frozen?: CreateDocumentRequest;
  private uploadAbort?: AbortController;
  private activeScope = '';
  private cancelled = false;
  private storagePrefix = '';
  private storageKey = '';

  constructor() {
    effect(() => {
      const state = this.session.state();
      const workspace = this.context.workspace();
      const scope =
        state.status === 'READY'
          ? `${state.membership.userId}:${state.membership.businessId}:${workspace?.kind ?? 'none'}:${workspace?.kind === 'SALON' ? workspace.salonId : ''}`
          : state.status;
      if (!this.activeScope) {
        this.activeScope = scope;
        if (state.status === 'READY') {
          this.storagePrefix = `barberhq:document-upload:${state.membership.userId}:${state.membership.businessId}`;
          this.storageKey = uploadTargetStorageKey(this.storagePrefix, this.data);
          if (!this.data.resume) this.restorePendingRegistration();
        }
        return;
      }
      if (scope !== this.activeScope) {
        const oldStoragePrefix = this.storagePrefix;
        clearScopeStorage(oldStoragePrefix);
        this.activeScope = scope;
        this.cancelled = true;
        this.uploadAbort?.abort();
        this.file = undefined;
        this.fileName.set('');
        this.storagePrefix =
          state.status === 'READY'
            ? `barberhq:document-upload:${state.membership.userId}:${state.membership.businessId}`
            : '';
        this.storageKey = this.storagePrefix
          ? uploadTargetStorageKey(this.storagePrefix, this.data)
          : '';
        this.ref.close();
      }
    });
    this.destroyRef.onDestroy(() => {
      this.cancelled = true;
      this.uploadAbort?.abort();
    });
  }

  submitLabelKey(): string {
    if (this.busy()) return 'procedures.upload.submit.working';
    if (this.registered()) return 'procedures.upload.submit.uploadSame';
    if (this.unknownRegistration()) return 'procedures.upload.submit.retryRegistration';
    return 'procedures.upload.submit.register';
  }
  selectFiles(files: FileList | readonly File[] | null): void {
    const file = files?.[0];
    this.file = undefined;
    this.fileName.set('');
    this.error.set(null);
    if (files && files.length > 1) {
      this.error.set({ key: 'procedures.upload.errors.oneFile' });
      return;
    }
    if (!file) return;
    if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
      this.error.set({ key: 'procedures.upload.errors.notPdf' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.error.set({ key: 'procedures.errors.pdfTooLarge' });
      return;
    }
    this.file = file;
    this.fileName.set(file.name);
  }

  async submit(value: UploadFormValue): Promise<void> {
    if (!this.file || this.busy()) return;
    this.error.set(null);
    this.busy.set(true);
    this.ref.disableClose = true;
    try {
      const sha256 = await this.api.hashPdf(this.file);
      if (this.cancelled) return;
      if (this.data.resume) {
        if (sha256 !== this.data.resume.pdfSha256)
          throw new TranslatedError({ key: 'procedures.upload.errors.fingerprint' });
        await this.upload(this.data.resume.versionId);
        return;
      }
      if (this.registered()) {
        if (this.frozen?.sha256 && sha256 !== this.frozen.sha256)
          throw new TranslatedError({ key: 'procedures.upload.errors.samePdf' });
        await this.upload(this.registered()!.versionId);
        return;
      }
      if (this.frozen && sha256 !== this.frozen.sha256)
        throw new TranslatedError({ key: 'procedures.upload.errors.frozen' });
      const urls = value.sourceUrls
        .split(/\r?\n/)
        .map((url) => url.trim())
        .filter(Boolean);
      if (
        !this.frozen &&
        value.origin === 'public-compilation' &&
        (!urls.length || !value.observedOn)
      )
        throw new TranslatedError({ key: 'procedures.upload.errors.publicSources' });
      this.frozen ??= Object.freeze({
        title: value.title.trim(),
        language: value.language,
        kind: value.kind,
        origin: value.origin,
        sourceUrls: Object.freeze(urls) as unknown as string[],
        observedOn: value.origin === 'public-compilation' ? value.observedOn : null,
        sha256,
        idempotencyKey: crypto.randomUUID(),
        ...(this.data.replaceTarget
          ? {
              documentId: this.data.replaceTarget.documentId,
              expectedDocumentRevision: this.data.replaceTarget.documentRevision,
            }
          : {}),
      });
      try {
        const result = await this.api.createDocumentUpload(this.frozen);
        if (this.cancelled) return;
        this.registered.set(result);
        this.unknownRegistration.set(false);
        this.clearPendingRegistration();
        persistPendingUpload(this.storageKey, result.versionId, sha256);
        await this.upload(result.versionId);
      } catch (error) {
        if (this.isUnknown(error)) {
          this.unknownRegistration.set(true);
          this.recoveredRegistration.set(this.frozen ?? null);
          persistPendingRegistration(this.storageKey, this.frozen);
        }
        throw error;
      }
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.busy.set(false);
      this.ref.disableClose = false;
    }
  }

  private async upload(versionId: string): Promise<void> {
    if (!this.file) return;
    const expectedHash = this.data.resume?.pdfSha256 ?? this.frozen?.sha256;
    if (expectedHash && (await this.api.hashPdf(this.file)) !== expectedHash)
      throw new TranslatedError({ key: 'procedures.upload.errors.samePdf' });
    this.uploadAbort = new AbortController();
    const status = await this.api.uploadPdf(versionId, this.file, this.uploadAbort.signal);
    if (this.cancelled) return;
    clearPendingUpload(this.storageKey);
    this.clearPendingRegistration();
    this.ref.close(status);
  }
  private isUnknown(error: unknown): boolean {
    return this.code(error) === 'OUTCOME_UNKNOWN' || this.code(error) === 'UPLOAD_FAILED';
  }
  private code(error: unknown): string {
    return typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  }
  private message(error: unknown): TranslatedText {
    const code = this.code(error);
    if (this.isUnknown(error))
      return {
        key: this.registered()
          ? 'procedures.upload.errors.uploadUnconfirmed'
          : 'procedures.upload.errors.registrationUnconfirmed',
      };
    if (code === 'UPLOAD_TOO_LARGE') return { key: 'procedures.errors.pdfTooLarge' };
    if (code === 'INVALID_PDF') return { key: 'procedures.upload.errors.invalidPdf' };
    if (code === 'STALE_STATE' || code === 'VERSION_CONFLICT')
      return { key: 'procedures.upload.errors.stale' };
    return translatedErrorText(error, { key: 'procedures.upload.errors.default' });
  }
  private restorePendingRegistration(): void {
    try {
      let raw = sessionStorage.getItem(this.storageKey);
      let sourceKey = this.storageKey;
      if (!raw && this.storagePrefix) {
        const legacyKey = this.storagePrefix;
        const legacyRaw = sessionStorage.getItem(legacyKey);
        if (legacyRaw && isRecoverableForTarget(legacyRaw, this.data)) {
          raw = legacyRaw;
          sourceKey = legacyKey;
        }
      }
      if (!raw) return;
      const value = JSON.parse(raw) as CreateDocumentRequest;
      if (isValidRegistration(value) && matchesUploadTarget(value, this.data)) {
        this.frozen = Object.freeze(value);
        this.recoveredRegistration.set(this.frozen);
        this.unknownRegistration.set(true);
        if (sourceKey !== this.storageKey) {
          sessionStorage.setItem(this.storageKey, JSON.stringify(this.frozen));
          sessionStorage.removeItem(sourceKey);
        }
      }
    } catch {
      /* Preserve unresolved metadata for a deliberate same-target retry. */
    }
  }
  private clearPendingRegistration(): void {
    this.recoveredRegistration.set(null);
    removePendingRegistration(this.storageKey);
  }
}
