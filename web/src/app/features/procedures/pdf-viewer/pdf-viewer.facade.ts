import { Service, computed, effect, inject, signal, DestroyRef } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import type { DocumentSource, SourceSection } from '../../../../../../shared/contracts/knowledge';
import { KnowledgeApi } from '../../../core/knowledge-api';
import { SessionFacade } from '../../auth/feature/session.facade';
import { SalonContext } from '../../../core/salon-context';
import { deliveryReturn } from '../../delivery/feature/delivery-return';
import { PdfRenderer } from './pdf-renderer';
import type { ScreenRect } from './pdf-overlay';

@Service({ autoProvided: false })
export class PdfViewerFacade {
  private readonly api = inject(KnowledgeApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(SessionFacade);
  private readonly workspace = inject(SalonContext);
  private readonly deliveryBack = computed(() => {
    const state = this.session.state(),
      query = this.query();
    return state.status === 'READY' && query
      ? deliveryReturn(query, state.membership, this.workspace.workspace())
      : null;
  });
  readonly backLabel = computed(() => this.deliveryBack()?.label ?? 'Procedures');
  private readonly params = toSignal(this.route.paramMap);
  private readonly query = toSignal(this.route.queryParamMap);
  private readonly renderer = new PdfRenderer();
  private bytes?: Uint8Array;
  private cachedFor?: { versionId: string; userId: string; businessId: string; session: object };
  private abort?: AbortController;
  private generation = 0;
  private renderGeneration = 0;
  private downloadUrl?: string;

  readonly source = signal<DocumentSource | SourceSection | null>(null);
  readonly section = computed(() => {
    const source = this.source();
    return source && 'chunkId' in source ? source : null;
  });
  readonly pageText = computed(
    () => this.source()?.pageTexts?.find((page) => page.physicalPage === this.page())?.text ?? '',
  );
  readonly loading = signal(true);
  readonly rendering = signal(false);
  readonly error = signal('');
  readonly page = signal(1);
  readonly zoom = signal(1);
  readonly rotation = signal(0);
  readonly overlay = signal<ScreenRect[]>([]);
  readonly viewport = signal<{ width: number; height: number } | null>(null);
  readonly renderToken = signal(0);
  readonly canDownload = computed(() => !!this.bytes && !!this.source());
  readonly proceduresLink = computed(() =>
    this.router.createUrlTree(['/procedures'], {
      queryParams: this.query()?.get('returnTo') === 'assistant' ? null : { tab: 'documents' },
    }),
  );

  constructor() {
    effect(() => {
      const session = this.session.state();
      const versionId = this.params()?.get('versionId');
      const chunkId = this.query()?.get('chunk');
      const page = this.query()?.get('page');
      if (session.status !== 'READY' || !versionId) {
        this.clear();
        return;
      }
      void this.load(versionId, chunkId ?? null, page ?? null, session.membership, session);
    });
    inject(DestroyRef).onDestroy(() => this.clear());
  }

  private clear(): void {
    this.generation++;
    this.abort?.abort();
    this.abort = undefined;
    this.resetView();
    this.releasePdf();
  }

  private resetView(): void {
    this.renderGeneration++;
    this.renderer.cancelRender();
    this.source.set(null);
    this.overlay.set([]);
    this.viewport.set(null);
    this.rendering.set(false);
  }

  private releasePdf(): void {
    this.renderer.dispose();
    this.bytes?.fill(0);
    this.bytes = undefined;
    this.cachedFor = undefined;
    if (this.downloadUrl) URL.revokeObjectURL(this.downloadUrl);
    this.downloadUrl = undefined;
  }

  private async load(
    versionId: string,
    chunkId: string | null,
    requestedPage: string | null,
    membership: { userId: string; businessId: string },
    session: object,
  ): Promise<void> {
    const reuse =
      !!this.bytes &&
      this.cachedFor?.versionId === versionId &&
      this.cachedFor.userId === membership.userId &&
      this.cachedFor.businessId === membership.businessId &&
      this.cachedFor.session === session;
    this.generation++;
    this.abort?.abort();
    this.abort = undefined;
    this.resetView();
    if (!reuse) this.releasePdf();
    const generation = this.generation;
    const abort = new AbortController();
    this.abort = abort;
    this.loading.set(true);
    this.error.set('');
    try {
      const source = chunkId
        ? await this.api.getSource(versionId, chunkId)
        : await this.api.getSource(versionId);
      if (generation !== this.generation) return;
      if (source.businessId !== membership.businessId)
        throw new Error('Source is unavailable or access was denied.');
      const page = chunkId
        ? (source as SourceSection).physicalPage
        : this.validPage(requestedPage, source.pageCount);
      if (page < 1 || page > source.pageCount) throw new Error('Source page is unavailable.');
      if (!reuse) {
        const bytes = await this.api.getPdf(versionId, abort.signal);
        if (generation !== this.generation) {
          bytes.fill(0);
          return;
        }
        this.bytes = bytes;
        await this.renderer.open(bytes);
        if (generation !== this.generation) return;
        this.cachedFor = {
          versionId,
          userId: membership.userId,
          businessId: membership.businessId,
          session,
        };
      }
      if (this.renderer.pageCount !== source.pageCount)
        throw new Error('PDF page count does not match the source record.');
      this.source.set(source);
      this.page.set(page);
      if (!reuse) {
        this.zoom.set(1);
        this.rotation.set(0);
      }
      this.renderToken.update((value) => value + 1);
    } catch (error) {
      if (generation === this.generation) {
        this.releasePdf();
        this.error.set(error instanceof Error ? error.message : 'Source could not be opened.');
      }
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }

  private validPage(raw: string | null, pageCount: number): number {
    const page = raw === null ? 1 : Number(raw);
    return Number.isInteger(page) && page >= 1 && page <= pageCount ? page : 1;
  }

  async render(canvas: HTMLCanvasElement): Promise<void> {
    const source = this.source();
    if (!source || !this.bytes) return;
    const generation = ++this.renderGeneration;
    this.rendering.set(true);
    this.overlay.set([]);
    try {
      const section = this.section();
      const rects =
        section?.physicalPage === this.page() && section.geometryStatus === 'VERIFIED'
          ? section.rects
          : [];
      const result = await this.renderer.render(
        canvas,
        this.page(),
        this.zoom(),
        this.rotation(),
        rects,
      );
      if (generation !== this.renderGeneration) return;
      this.viewport.set({ width: result.width, height: result.height });
      this.overlay.set(result.rects);
      this.error.set('');
    } catch (error) {
      if (generation === this.renderGeneration)
        this.error.set(error instanceof Error ? error.message : 'Page could not be rendered.');
    } finally {
      if (generation === this.renderGeneration) this.rendering.set(false);
    }
  }

  goBack(): void {
    const delivery = this.deliveryBack();
    if (delivery)
      void this.router.navigate(delivery.commands, { queryParams: delivery.queryParams });
    else void this.router.navigateByUrl(this.proceduresLink());
  }

  setZoom(value: number): void {
    if (value < 0.5 || value > 2 || value === this.zoom()) return;
    this.zoom.set(value);
  }
  rotate(): void {
    this.rotation.update((value) => (value + 90) % 360);
  }
  pageBy(delta: number): void {
    const source = this.source();
    const target = this.page() + delta;
    if (!source || target < 1 || target > source.pageCount) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: target, chunk: null },
      queryParamsHandling: 'merge',
    });
  }
  retry(): void {
    const versionId = this.params()?.get('versionId');
    const session = this.session.state();
    if (versionId && session.status === 'READY')
      void this.load(
        versionId,
        this.query()?.get('chunk') ?? null,
        this.query()?.get('page') ?? null,
        session.membership,
        session,
      );
  }
  download(): void {
    const bytes = this.bytes;
    const source = this.source();
    if (!bytes || !source) return;
    if (this.downloadUrl) URL.revokeObjectURL(this.downloadUrl);
    const url = URL.createObjectURL(
      new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' }),
    );
    this.downloadUrl = url;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${source.documentId}-${source.version}.pdf`;
    anchor.click();
    window.setTimeout(() => {
      if (this.downloadUrl === url) {
        URL.revokeObjectURL(url);
        this.downloadUrl = undefined;
      }
    }, 1000);
  }
}
