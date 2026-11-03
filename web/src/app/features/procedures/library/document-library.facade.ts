import { DestroyRef, Service, computed, effect, inject, signal } from '@angular/core';
import { ClientLog } from '../../../core/client-log';
import type { Page } from '../../../../../../shared/contracts/business/index';
import type {
  DeleteVersionInput,
  DocumentRow,
  RetryDocumentInput,
  VersionStatus,
} from '../../../../../../shared/contracts/knowledge/index';
import type { TranslatedText } from '../../../core/models/translated-text';
import { KnowledgeApi } from '../../../core/knowledge-api';
import { SalonContext } from '../../../core/salon-context';
import { SessionFacade } from '../../auth/feature/session.facade';

const PAGE_SIZE = 20;

@Service({ autoProvided: false })
export class DocumentLibraryFacade {
  private readonly api = inject(KnowledgeApi);
  private readonly log = inject(ClientLog);
  private readonly session = inject(SessionFacade);
  private readonly context = inject(SalonContext);
  private readonly destroyRef = inject(DestroyRef);
  private readonly commands = new Map<string, { key: string; payload: object }>();
  private generation = 0;
  private inFlightGeneration: number | null = null;
  private timer?: ReturnType<typeof setInterval>;
  private visibilityHandler?: () => void;
  private scope = '';
  private ownerScope = '';
  private commandStorageKey = '';
  readonly rows = signal<DocumentRow[]>([]);
  readonly nextOffset = signal<number | null>(null);
  readonly offset = signal(0);
  readonly loading = signal(true);
  readonly error = signal<TranslatedText | null>(null);
  readonly busyVersion = signal<string | null>(null);
  readonly notice = signal<TranslatedText | null>(null);
  readonly isHqWorkspace = computed(() => this.context.workspace()?.kind === 'HQ');
  readonly isSalonWorkspace = computed(() => this.context.workspace()?.kind === 'SALON');
  readonly hasMore = computed(() => this.nextOffset() !== null);

  constructor() {
    effect(() => {
      const state = this.session.state();
      const workspace = this.context.workspace();
      const nextScope =
        state.status === 'READY'
          ? `${state.membership.userId}:${state.membership.businessId}:${workspace?.kind ?? 'none'}:${workspace?.kind === 'SALON' ? workspace.salonId : ''}`
          : state.status;
      if (nextScope === this.scope) return;
      const nextOwner =
        state.status === 'READY'
          ? `${state.membership.userId}:${state.membership.businessId}`
          : state.status;
      if (this.ownerScope !== nextOwner) {
        this.removeOwnerCommands();
        this.ownerScope = nextOwner;
        this.commandStorageKey =
          state.status === 'READY'
            ? `barberhq:document-library:${state.membership.userId}:${state.membership.businessId}`
            : '';
        this.commands.clear();
        if (this.commandStorageKey) this.restoreCommands();
      }
      this.scope = nextScope;
      this.generation++;
      this.inFlightGeneration = null;
      this.rows.set([]);
      this.nextOffset.set(null);
      this.offset.set(0);
      this.error.set(null);
      this.notice.set(null);
      if (state.status === 'READY') void this.load(0, true);
      else this.loading.set(false);
    });
    this.timer = setInterval(() => {
      if (document.visibilityState === 'visible' && this.session.state().status === 'READY')
        void this.refreshQuietly();
    }, 5000);
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible' && this.session.state().status === 'READY')
        void this.refreshQuietly();
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.destroyRef.onDestroy(() => {
      this.generation++;
      if (this.timer) clearInterval(this.timer);
      if (this.visibilityHandler)
        document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.commands.clear();
    });
  }

  refresh(): void {
    void this.load(this.offset(), true);
  }
  previous(): void {
    const offset = Math.max(0, this.offset() - PAGE_SIZE);
    void this.load(offset, true);
  }
  next(): void {
    const offset = this.nextOffset();
    if (offset !== null) void this.load(offset, true);
  }

  async retry(row: DocumentRow): Promise<void> {
    const payload = this.freeze(`retry:${row.versionId}`, {
      versionId: row.versionId,
      sha256: row.pdfSha256,
      idempotencyKey: this.key(`retry:${row.versionId}`),
    } satisfies RetryDocumentInput);
    await this.run(row.versionId, `retry:${row.versionId}`, payload, () =>
      this.api.retryDocumentProcessing(payload as RetryDocumentInput),
    );
  }

  async withdraw(row: DocumentRow): Promise<void> {
    const payload = this.freeze(`withdraw:${row.versionId}`, {
      versionId: row.versionId,
      expectedDocumentRevision: row.documentRevision,
      expectedVersionRevision: row.versionRevision,
      idempotencyKey: this.key(`withdraw:${row.versionId}`),
    } satisfies DeleteVersionInput);
    await this.run(row.versionId, `withdraw:${row.versionId}`, payload, () =>
      this.api.deleteKnowledgeVersion(payload as DeleteVersionInput),
    );
  }

  private async run(
    versionId: string,
    key: string,
    payload: object,
    operation: () => Promise<VersionStatus>,
  ): Promise<void> {
    this.busyVersion.set(versionId);
    this.notice.set(null);
    try {
      const result = await operation();
      this.notice.set(this.statusMessage(result, key));
      this.commands.delete(key);
      this.persistCommands();
      void this.load(this.offset(), true);
    } catch (error) {
      const code = this.errorCode(error);
      if (code === 'STALE_STATE' || code === 'VERSION_CONFLICT') {
        this.commands.delete(key);
        this.persistCommands();
      }
      if (code !== 'OUTCOME_UNKNOWN' && code !== 'UPLOAD_FAILED')
        await this.load(this.offset(), true);
      this.error.set(this.messageFor(code));
    } finally {
      this.busyVersion.set(null);
    }
  }

  private async refreshQuietly(): Promise<void> {
    if (this.inFlightGeneration === this.generation || !this.rows().length) return;
    await this.load(this.offset(), false);
  }

  private async load(offset: number, showLoading: boolean): Promise<void> {
    const generation = this.generation;
    if (this.inFlightGeneration === generation || this.session.state().status !== 'READY') return;
    this.inFlightGeneration = generation;
    if (showLoading && !this.rows().length) this.loading.set(true);
    this.error.set(null);
    try {
      const page: Page<DocumentRow> = await this.api.listDocuments({ limit: PAGE_SIZE, offset });
      if (generation !== this.generation || this.session.state().status !== 'READY') return;
      this.offset.set(offset);
      this.nextOffset.set(page.nextOffset);
      const current = this.rows();
      if (JSON.stringify(current) !== JSON.stringify(page.items)) this.rows.set(page.items);
    } catch (error) {
      // Only failures: the library polls while visible, so successes would flood the log.
      this.log.record('knowledge.library.load', 'error', { code: this.errorCode(error) });
      if (generation === this.generation) this.error.set(this.messageFor(this.errorCode(error)));
    } finally {
      if (generation === this.generation) this.loading.set(false);
      if (this.inFlightGeneration === generation) this.inFlightGeneration = null;
    }
  }

  private freeze(key: string, payload: object): object {
    const existing = this.commands.get(key);
    if (existing) return existing.payload;
    this.commands.set(key, { key, payload: Object.freeze({ ...payload }) });
    this.persistCommands();
    return this.commands.get(key)!.payload;
  }
  private key(operation: string): string {
    return this.commands.get(operation)?.key ?? crypto.randomUUID();
  }
  private errorCode(error: unknown): string {
    return typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : 'UPLOAD_FAILED';
  }
  private messageFor(code: string): TranslatedText {
    const messages: Record<string, string> = {
      FORBIDDEN: 'procedures.library.errors.FORBIDDEN',
      UNAUTHENTICATED: 'procedures.library.errors.UNAUTHENTICATED',
      STALE_STATE: 'procedures.library.errors.STALE_STATE',
      VERSION_CONFLICT: 'procedures.library.errors.VERSION_CONFLICT',
      UPLOAD_TOO_LARGE: 'procedures.errors.pdfTooLarge',
      INVALID_PDF: 'procedures.library.errors.INVALID_PDF',
      UNSUPPORTED_PDF: 'procedures.library.errors.UNSUPPORTED_PDF',
      OUTCOME_UNKNOWN: 'procedures.library.errors.OUTCOME_UNKNOWN',
      UPLOAD_FAILED: 'procedures.library.errors.UPLOAD_FAILED',
    };
    return { key: messages[code] ?? 'procedures.library.errors.default' };
  }
  private statusMessage(status: VersionStatus, operation: string): TranslatedText {
    if (operation.startsWith('withdraw:')) {
      return {
        key: status.revokedAt
          ? 'procedures.library.notices.withdrawn'
          : 'procedures.library.notices.withdrawalAccepted',
      };
    }
    const messages: Record<VersionStatus['status'], string> = {
      STAGED: 'procedures.library.notices.STAGED',
      EXTRACTED: 'procedures.library.notices.EXTRACTED',
      REVIEWED: 'procedures.library.notices.REVIEWED',
      EMBEDDED: 'procedures.library.notices.EMBEDDED',
      READY: 'procedures.library.notices.READY',
      NEEDS_REVIEW: 'procedures.library.notices.NEEDS_REVIEW',
      FAILED: 'procedures.library.notices.FAILED',
    };
    return { key: messages[status.status] };
  }
  private restoreCommands(): void {
    try {
      const raw = sessionStorage.getItem(this.commandStorageKey);
      if (!raw) return;
      const entries = JSON.parse(raw) as [string, { key: string; payload: object }][];
      for (const [name, command] of entries) {
        if (
          typeof name === 'string' &&
          typeof command?.key === 'string' &&
          command.payload &&
          typeof command.payload === 'object'
        )
          this.commands.set(name, { key: command.key, payload: Object.freeze(command.payload) });
      }
    } catch {
      this.commands.clear();
    }
  }
  private persistCommands(): void {
    try {
      if (this.commandStorageKey && this.commands.size)
        sessionStorage.setItem(
          this.commandStorageKey,
          JSON.stringify([...this.commands.entries()]),
        );
      else if (this.commandStorageKey) sessionStorage.removeItem(this.commandStorageKey);
    } catch {
      /* In-memory replay remains available during this library view. */
    }
  }
  private removeOwnerCommands(): void {
    try {
      const prefix = `barberhq:document-library:${this.ownerScope}`;
      if (this.ownerScope) sessionStorage.removeItem(prefix);
    } catch {
      /* Storage may be disabled by the browser. */
    }
  }
}
