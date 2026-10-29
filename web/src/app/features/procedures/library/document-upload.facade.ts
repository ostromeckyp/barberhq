import { DestroyRef, Service, effect, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import type {
  CreateDocumentRequest,
  KnowledgeDocumentKind,
  KnowledgeOrigin,
  DocumentRow,
  VersionStatus,
} from '../../../../../../shared/contracts/knowledge/index';
import { KnowledgeApi } from '../../../core/knowledge-api';
import { SalonContext } from '../../../core/salon-context';
import { SessionFacade } from '../../auth/feature/session.facade';
export type UploadDialogData = {
  resume?: DocumentRow;
  replaceTarget?: Pick<DocumentRow, 'documentId' | 'documentRevision' | 'title' | 'version'> &
    Partial<Pick<DocumentRow, 'language' | 'kind' | 'origin' | 'sourceUrls' | 'observedOn'>>;
};

export type UploadFormValue = {
  title: string;
  language: 'en' | 'pl';
  kind: KnowledgeDocumentKind;
  origin: KnowledgeOrigin;
  sourceUrls: string;
  observedOn: string;
};

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
  readonly error = signal('');
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
          this.storageKey = this.targetStorageKey();
          if (!this.data.resume) this.restorePendingRegistration();
        }
        return;
      }
      if (scope !== this.activeScope) {
        const oldStoragePrefix = this.storagePrefix;
        this.clearScopeStorage(oldStoragePrefix);
        this.activeScope = scope;
        this.cancelled = true;
        this.uploadAbort?.abort();
        this.file = undefined;
        this.fileName.set('');
        this.storagePrefix =
          state.status === 'READY'
            ? `barberhq:document-upload:${state.membership.userId}:${state.membership.businessId}`
            : '';
        this.storageKey = this.storagePrefix ? this.targetStorageKey() : '';
        this.ref.close();
      }
    });
    this.destroyRef.onDestroy(() => {
      this.cancelled = true;
      this.uploadAbort?.abort();
    });
  }

  submitLabel(): string {
    if (this.busy()) return 'Working…';
    if (this.registered()) return 'Upload same version';
    if (this.unknownRegistration()) return 'Retry same registration';
    return 'Register and upload';
  }
  selectFiles(files: FileList | readonly File[] | null): void {
    const file = files?.[0];
    this.file = undefined;
    this.fileName.set('');
    this.error.set('');
    if (files && files.length > 1) {
      this.error.set('Choose one PDF file at a time.');
      return;
    }
    if (!file) return;
    if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
      this.error.set('Choose a PDF file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.error.set('The PDF exceeds the 10 MiB limit.');
      return;
    }
    this.file = file;
    this.fileName.set(file.name);
  }

  async submit(value: UploadFormValue): Promise<void> {
    if (!this.file || this.busy()) return;
    this.error.set('');
    this.busy.set(true);
    this.ref.disableClose = true;
    try {
      const sha256 = await this.api.hashPdf(this.file);
      if (this.cancelled) return;
      if (this.data.resume) {
        if (sha256 !== this.data.resume.pdfSha256)
          throw new Error('Choose the original PDF with the registered SHA-256 fingerprint.');
        await this.upload(this.data.resume.versionId);
        return;
      }
      if (this.registered()) {
        if (this.frozen?.sha256 && sha256 !== this.frozen.sha256)
          throw new Error('Choose the same PDF that was registered.');
        await this.upload(this.registered()!.versionId);
        return;
      }
      if (this.frozen && sha256 !== this.frozen.sha256)
        throw new Error(
          'Choose the PDF from the unresolved registration. Its version identity is frozen.',
        );
      const urls = value.sourceUrls
        .split(/\r?\n/)
        .map((url) => url.trim())
        .filter(Boolean);
      if (
        !this.frozen &&
        value.origin === 'public-compilation' &&
        (!urls.length || !value.observedOn)
      )
        throw new Error('Public compilations require source URLs and an observation date.');
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
        this.persistPendingUpload(result.versionId, sha256);
        await this.upload(result.versionId);
      } catch (error) {
        if (this.isUnknown(error)) {
          this.unknownRegistration.set(true);
          this.recoveredRegistration.set(this.frozen ?? null);
          this.persistPendingRegistration();
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
      throw new Error('Choose the same PDF that was registered.');
    this.uploadAbort = new AbortController();
    const status = await this.api.uploadPdf(versionId, this.file, this.uploadAbort.signal);
    if (this.cancelled) return;
    this.clearPendingUpload();
    this.clearPendingRegistration();
    this.ref.close(status);
  }
  private isUnknown(error: unknown): boolean {
    return this.code(error) === 'OUTCOME_UNKNOWN' || this.code(error) === 'UPLOAD_FAILED';
  }
  private code(error: unknown): string {
    return typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  }
  private message(error: unknown): string {
    const code = this.code(error);
    if (this.isUnknown(error))
      return this.registered()
        ? 'The upload result could not be confirmed. Retry this same version with the same PDF.'
        : 'The registration result could not be confirmed. Retry the same registration; it keeps the same version request.';
    if (code === 'UPLOAD_TOO_LARGE') return 'The PDF exceeds the 10 MiB limit.';
    if (code === 'INVALID_PDF') return 'Choose a readable, text-supported PDF.';
    if (code === 'STALE_STATE' || code === 'VERSION_CONFLICT')
      return 'The document changed. Close this dialog and refresh before replacing it.';
    return error instanceof Error
      ? error.message
      : 'The document could not be uploaded. Please retry.';
  }
  private restorePendingRegistration(): void {
    try {
      let raw = sessionStorage.getItem(this.storageKey);
      let sourceKey = this.storageKey;
      if (!raw && this.storagePrefix) {
        const legacyKey = this.storagePrefix;
        const legacyRaw = sessionStorage.getItem(legacyKey);
        if (legacyRaw && this.isRecoverableForCurrentTarget(legacyRaw)) {
          raw = legacyRaw;
          sourceKey = legacyKey;
        }
      }
      if (!raw) return;
      const value = JSON.parse(raw) as CreateDocumentRequest;
      if (this.isValidRegistration(value) && this.matchesCurrentTarget(value)) {
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
  private isRecoverableForCurrentTarget(raw: string): boolean {
    try {
      const value = JSON.parse(raw) as CreateDocumentRequest;
      return this.isValidRegistration(value) && this.matchesCurrentTarget(value);
    } catch {
      return false;
    }
  }
  private isValidRegistration(value: CreateDocumentRequest): boolean {
    return (
      typeof value.idempotencyKey === 'string' &&
      typeof value.sha256 === 'string' &&
      Array.isArray(value.sourceUrls)
    );
  }
  private matchesCurrentTarget(value: CreateDocumentRequest): boolean {
    if (this.data.resume) return false;
    if (this.data.replaceTarget) return value.documentId === this.data.replaceTarget.documentId;
    return value.documentId === undefined;
  }
  private targetStorageKey(): string {
    if (this.data.resume)
      return `${this.storagePrefix}:resume:${encodeURIComponent(this.data.resume.versionId)}`;
    if (this.data.replaceTarget)
      return `${this.storagePrefix}:replace:${encodeURIComponent(this.data.replaceTarget.documentId)}`;
    return `${this.storagePrefix}:new`;
  }
  private persistPendingRegistration(): void {
    try {
      if (this.frozen && this.storageKey)
        sessionStorage.setItem(this.storageKey, JSON.stringify(this.frozen));
    } catch {
      /* In-memory replay remains available in this dialog. */
    }
  }
  private clearPendingRegistration(): void {
    this.recoveredRegistration.set(null);
    try {
      if (this.storageKey) sessionStorage.removeItem(this.storageKey);
    } catch {
      /* Storage may be disabled by the browser. */
    }
  }
  private persistPendingUpload(versionId: string, sha256: string): void {
    try {
      if (this.storageKey)
        sessionStorage.setItem(`${this.storageKey}:staged`, JSON.stringify({ versionId, sha256 }));
    } catch {
      /* The server list remains the durable record. */
    }
  }
  private clearPendingUpload(): void {
    try {
      if (this.storageKey) sessionStorage.removeItem(`${this.storageKey}:staged`);
    } catch {
      /* Storage may be disabled by the browser. */
    }
  }
  private clearScopeStorage(storageKey: string): void {
    try {
      const prefix = storageKey;
      if (!prefix) return;
      for (let index = sessionStorage.length - 1; index >= 0; index--) {
        const key = sessionStorage.key(index);
        if (key === prefix || key?.startsWith(`${prefix}:`)) sessionStorage.removeItem(key);
      }
    } catch {
      /* Storage may be disabled by the browser. */
    }
  }
}
