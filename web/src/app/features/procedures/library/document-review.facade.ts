import { ProductKnowledgeReviewFacade } from './product-knowledge-review.facade';
import { DestroyRef, Service, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import type {
  KnowledgeReview,
  ReviewDocumentInput,
} from '../../../../../../shared/contracts/knowledge/index';
import { KnowledgeApi } from '../../../core/knowledge-api';
import { SessionFacade } from '../../auth/feature/session.facade';
import { PdfRenderer } from '../pdf-viewer/pdf-renderer';
import { DOCUMENT_PDF_RENDERER } from './document-review-renderer';

@Service({ autoProvided: false })
export class DocumentReviewFacade {
  private readonly api = inject(KnowledgeApi);
  private readonly productKnowledge = inject(ProductKnowledgeReviewFacade, { optional: true });
  private readonly session = inject(SessionFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.paramMap);
  private readonly renderer = inject(DOCUMENT_PDF_RENDERER);
  private readonly destroyRef = inject(DestroyRef);
  private generation = 0;
  private renderGeneration = 0;
  private fetchingGeneration: number | null = null;
  private loadAbort?: AbortController;
  private bytes?: Uint8Array;
  private timer?: ReturnType<typeof setInterval>;
  private visibleHandler?: () => void;
  private identity = '';
  private ownerScope = '';
  private readonly frozenCommand = signal<ReviewDocumentInput | undefined>(undefined);
  private frozenStorageKey = '';
  readonly review = signal<KnowledgeReview | null>(null);
  readonly publicationAllowed = signal(false);
  readonly published = signal(false);
  readonly pageNumber = signal(1);
  readonly renderedPages = signal<ReadonlySet<number>>(new Set());
  readonly checkedPages = signal<ReadonlySet<number>>(new Set());
  readonly loading = signal(true);
  readonly rendering = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly currentPage = computed(() =>
    this.review()?.pages.find((page) => page.physicalPage === this.pageNumber()),
  );
  readonly totalPages = computed(() => this.review()?.pages.length ?? 0);
  readonly allPagesRendered = computed(
    () => this.totalPages() > 0 && this.renderedPages().size === this.totalPages(),
  );
  readonly allPagesChecked = computed(
    () => this.totalPages() > 0 && this.checkedPages().size === this.totalPages(),
  );
  readonly canPublish = computed(
    () =>
      !this.published() &&
      this.publicationAllowed() &&
      this.allPagesRendered() &&
      this.allPagesChecked() &&
      !this.busy() &&
      (!(
        this.review()?.version.kind === 'product-card' ||
        this.review()?.version.kind === 'product-catalog'
      ) ||
        this.productKnowledge?.ready() === true),
  );
  readonly hasFrozen = computed(() => this.frozenCommand() !== undefined);
  readonly publishLabel = computed(() =>
    this.frozenCommand() ? 'Retry same publication' : 'Publish version',
  );

  refresh(): void {
    const id = this.params()?.get('versionId');
    if (id) void this.load(id, false);
  }

  constructor() {
    effect(() => {
      const state = this.session.state();
      const versionId = this.params()?.get('versionId');
      const currentIdentity =
        state.status === 'READY' && versionId
          ? `${state.membership.userId}:${state.membership.businessId}:${versionId}`
          : state.status;
      if (currentIdentity === this.identity) return;
      const nextOwner =
        state.status === 'READY'
          ? `${state.membership.userId}:${state.membership.businessId}`
          : state.status;
      if (this.ownerScope && nextOwner !== this.ownerScope) {
        this.removeOwnerStorage(this.ownerScope);
        this.frozenStorageKey = '';
      }
      this.ownerScope = nextOwner;
      this.identity = currentIdentity;
      this.clear();
      if (state.status === 'READY' && versionId) {
        this.frozenStorageKey = this.storageKey(
          state.membership.userId,
          state.membership.businessId,
          versionId,
        );
        this.frozenCommand.set(this.readFrozen(this.frozenStorageKey));
        void this.load(versionId, false);
      } else {
        this.frozenStorageKey = '';
        this.loading.set(false);
      }
    });
    this.timer = setInterval(() => {
      const id = this.params()?.get('versionId');
      if (id && document.visibilityState === 'visible' && this.session.state().status === 'READY')
        void this.load(id, true);
    }, 5000);
    this.visibleHandler = () => {
      const id = this.params()?.get('versionId');
      if (id && document.visibilityState === 'visible' && this.session.state().status === 'READY')
        void this.load(id, true);
    };
    document.addEventListener('visibilitychange', this.visibleHandler);
    this.destroyRef.onDestroy(() => {
      this.generation++;
      this.renderGeneration++;
      this.loadAbort?.abort();
      if (this.timer) clearInterval(this.timer);
      if (this.visibleHandler)
        document.removeEventListener('visibilitychange', this.visibleHandler);
      this.releasePdf();
    });
  }

  pageBy(delta: number): void {
    const target = this.pageNumber() + delta;
    if (target >= 1 && target <= this.totalPages()) this.pageNumber.set(target);
  }
  togglePage(checked: boolean): void {
    const page = this.pageNumber();
    if (!this.renderedPages().has(page)) return;
    this.checkedPages.update((current) => {
      const next = new Set(current);
      checked ? next.add(page) : next.delete(page);
      return next;
    });
  }
  async render(canvas: HTMLCanvasElement): Promise<void> {
    const review = this.review();
    if (!review || !this.bytes) return;
    const generation = this.renderGeneration;
    const pageNumber = this.pageNumber();
    this.rendering.set(true);
    try {
      await this.renderer.render(canvas, pageNumber, 1, 0, []);
      if (generation !== this.renderGeneration) return;
      this.renderedPages.update((current) => new Set(current).add(pageNumber));
      this.error.set('');
    } catch (error) {
      if (generation === this.renderGeneration)
        this.error.set(
          error instanceof Error ? error.message : 'Original page could not be rendered.',
        );
    } finally {
      if (generation === this.renderGeneration) this.rendering.set(false);
    }
  }

  async publish(): Promise<void> {
    const review = this.review();
    if (!review || this.published() || (!this.frozenCommand() && !this.canPublish()) || this.busy())
      return;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    const input =
      this.frozenCommand() ??
      Object.freeze({
        versionId: review.version.versionId,
        extractionHash: review.extractionHash,
        reviewedPhysicalPages: [...this.checkedPages()].sort((a, b) => a - b),
        expectedDocumentRevision: review.version.documentRevision,
        idempotencyKey: crypto.randomUUID(),
        ...((review.version.kind === 'product-card' || review.version.kind === 'product-catalog') &&
        this.productKnowledge?.review()?.reviewedHash
          ? { productKnowledgeReviewedHash: this.productKnowledge.review()!.reviewedHash! }
          : {}),
      });
    this.frozenCommand.set(input);
    this.persistFrozen();
    try {
      const result = await this.api.reviewAndPublishDocument(input);
      this.frozenCommand.set(undefined);
      this.removeFrozen();
      this.notice.set(
        result.status === 'READY'
          ? 'Publication queued. The server will finish this version in the background.'
          : `Server status: ${result.status}.`,
      );
      const id = this.params()?.get('versionId');
      if (id) await this.load(id, false);
    } catch (error) {
      const code = this.errorCode(error);
      if (code === 'STALE_STATE' || code === 'VERSION_CONFLICT') {
        this.frozenCommand.set(undefined);
        this.removeFrozen();
        this.checkedPages.set(new Set());
        this.renderedPages.set(new Set());
        const id = this.params()?.get('versionId');
        if (id) await this.load(id, false);
        if (this.productKnowledge?.workspace()) await this.productKnowledge.refresh();
        this.error.set(
          'The version changed during review. The latest extraction is loaded; review every page again before publishing.',
        );
      } else if (code === 'OUTCOME_UNKNOWN' || code === 'UPLOAD_FAILED') {
        this.error.set(
          'The publication result could not be confirmed. Retry the same publication to check its status safely.',
        );
      } else {
        this.frozenCommand.set(undefined);
        this.removeFrozen();
        this.error.set(
          'The document could not be published. Refresh and review the current version before retrying.',
        );
      }
    } finally {
      this.busy.set(false);
    }
  }
  back(): void {
    void this.router.navigate(['/procedures'], { queryParams: { tab: 'documents' } });
  }

  private async load(versionId: string, quiet: boolean): Promise<void> {
    if (quiet && this.fetchingGeneration !== null) return;
    const generation = ++this.generation;
    this.fetchingGeneration = generation;
    this.loadAbort?.abort();
    this.loadAbort = new AbortController();
    if (!quiet) this.loading.set(true);
    try {
      const review = await this.api.getReview(versionId);
      if (generation !== this.generation || this.session.state().status !== 'READY') return;
      const previous = this.review();
      const unchanged =
        previous?.version.versionId === review.version.versionId &&
        previous.version.versionRevision === review.version.versionRevision &&
        previous.version.documentRevision === review.version.documentRevision &&
        previous.extractionHash === review.extractionHash;
      this.publicationAllowed.set(review.publicationAllowed);
      this.published.set(!!review.version.publishedAt && !review.version.revokedAt);
      if (this.published()) this.notice.set('');
      if (!unchanged) {
        this.renderGeneration++;
        this.checkedPages.set(new Set());
        this.renderedPages.set(new Set());
        this.pageNumber.set(1);
        this.releasePdf();
        const bytes = await this.api.getPdf(versionId, this.loadAbort.signal);
        if (generation !== this.generation) {
          bytes.fill(0);
          return;
        }
        this.bytes = bytes;
        await this.renderer.open(bytes);
        if (generation !== this.generation) return;
        if (this.renderer.pageCount !== review.version.pageCount)
          throw new Error('PDF page count does not match the extracted page set.');
        this.frozenCommand.update((frozen) => frozen ?? this.readFrozen(this.frozenStorageKey));
        const frozen = this.frozenCommand();
        if (
          frozen &&
          (frozen.versionId !== review.version.versionId ||
            frozen.extractionHash !== review.extractionHash)
        ) {
          this.frozenCommand.set(undefined);
          this.removeFrozen();
        }
        this.review.set(review);
      }
      this.error.set('');
    } catch (error) {
      if (generation === this.generation) this.error.set(this.loadErrorMessage(error));
    } finally {
      if (this.fetchingGeneration === generation) this.fetchingGeneration = null;
      if (generation === this.generation) this.loading.set(false);
    }
  }
  private clear(): void {
    this.productKnowledge?.clear();
    this.generation++;
    this.renderGeneration++;
    this.fetchingGeneration = null;
    this.loadAbort?.abort();
    this.loadAbort = undefined;
    this.review.set(null);
    this.publicationAllowed.set(false);
    this.published.set(false);
    this.checkedPages.set(new Set());
    this.renderedPages.set(new Set());
    this.frozenCommand.set(undefined);
    this.error.set('');
    this.loading.set(true);
    this.releasePdf();
  }
  private releasePdf(): void {
    this.renderer.dispose();
    this.bytes?.fill(0);
    this.bytes = undefined;
  }
  private errorCode(error: unknown): string {
    return typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  }
  private loadErrorMessage(error: unknown): string {
    const code = this.errorCode(error);
    if (code === 'FORBIDDEN')
      return 'This document review is unavailable in the selected workspace.';
    if (code === 'UNAUTHENTICATED') return 'Sign in again to continue this review.';
    return 'The review and original PDF could not be loaded. Retry to refresh the current version.';
  }
  private storageKey(userId: string, businessId: string, versionId: string): string {
    return `barberhq:document-review:${userId}:${businessId}:${versionId}`;
  }
  private readFrozen(key: string): ReviewDocumentInput | undefined {
    if (!key) return undefined;
    try {
      const value = sessionStorage.getItem(key);
      return value ? (JSON.parse(value) as ReviewDocumentInput) : undefined;
    } catch {
      return undefined;
    }
  }
  private persistFrozen(): void {
    try {
      const frozen = this.frozenCommand();
      if (this.frozenStorageKey && frozen)
        sessionStorage.setItem(this.frozenStorageKey, JSON.stringify(frozen));
    } catch {
      /* In-memory replay still preserves this view's command. */
    }
  }
  private removeFrozen(): void {
    try {
      if (this.frozenStorageKey) sessionStorage.removeItem(this.frozenStorageKey);
    } catch {
      /* Storage may be disabled by the browser. */
    }
  }
  private removeOwnerStorage(owner: string): void {
    try {
      const prefix = `barberhq:document-review:${owner}:`;
      for (let index = sessionStorage.length - 1; index >= 0; index--) {
        const key = sessionStorage.key(index);
        if (key?.startsWith(prefix)) sessionStorage.removeItem(key);
      }
    } catch {
      /* Storage may be disabled by the browser. */
    }
  }
}
