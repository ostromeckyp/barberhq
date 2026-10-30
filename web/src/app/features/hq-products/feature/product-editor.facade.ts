import { Service, inject, signal } from '@angular/core';
import type {
  HqStock,
  ProductCategory,
  ProductAliasChange,
  ProductAliasKind,
  ProductAliasRow,
  ProductAliasesResult,
  ProductForm,
} from '../../../../../../shared/contracts/product-admin/index';
import type { TranslatedText } from '../../../core/models/translated-text';
import { ProductAdminApi, ProductAdminError } from '../data-access/product-admin-api';
import type { CardAttachmentState } from '../models/card-attachment-state';
import type { CardSuggestion } from '../models/card-suggestion';

/** Optional text fields are edited as strings; empty means none. */
export type ProductDraft = Omit<ProductForm, 'type' | 'scent' | 'category'> & {
  /** Empty until HQ picks one; the form requires it. */
  category: ProductCategory | '';
  type: string;
  scent: string;
  hqOnHand: number;
};
const emptyDraft = (): ProductDraft => ({
  name: '',
  brand: '',
  category: '',
  type: '',
  summary: '',
  scent: '',
  netContentMl: 100,
  retailPriceGrosz: 0,
  sourceCode: '',
  sourceUrl: 'https://',
  observedOn: new Date().toISOString().slice(0, 10),
  hqOnHand: 0,
});
const code = (error: unknown) => (error instanceof ProductAdminError ? error.code : 'UNKNOWN');
const cardFailure = (error: unknown): TranslatedText => ({
  key:
    code(error) === 'RATE_LIMITED'
      ? 'hq.products.card.rateLimited'
      : 'hq.products.card.processFailed',
});
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One HQ product screen with independent sections: form, HQ quantity, aliases and card.
 * Each section keeps its own draft and pending key, so polling or saving one never resets another.
 */
@Service({ autoProvided: false })
export class ProductEditorFacade {
  private readonly api = inject(ProductAdminApi);
  readonly productId = signal<string | null>(null);
  readonly model = signal<ProductDraft>(emptyDraft());
  readonly saving = signal(false);
  readonly loading = signal(false);
  readonly loadFailed = signal(false);
  private loadedId = '';
  readonly message = signal<TranslatedText | null>(null);
  private revision = 0;
  private formKey: string | null = null;
  readonly stock = signal<HqStock | null>(null);
  readonly stockDraft = signal(0);
  readonly stockMessage = signal<TranslatedText | null>(null);

  readonly aliases = signal<ProductAliasRow[]>([]);
  readonly collisions = signal<ProductAliasesResult['collisions']>([]);
  readonly newAliasKind = signal<ProductAliasKind>('NAME');
  readonly aliasMessage = signal<TranslatedText | null>(null);
  private pendingAliases: { changes: ProductAliasChange[]; key: string } | null = null;

  readonly card = signal<CardAttachmentState | null>(null);
  readonly suggestions = signal<CardSuggestion[]>([]);
  readonly cardMessage = signal<TranslatedText | null>(null);

  startNew(): void {
    this.productId.set(null);
    this.model.set(emptyDraft());
    this.revision = 0;
    this.formKey = null;
  }
  async load(productId: string): Promise<void> {
    this.loadedId = productId;
    this.loading.set(true);
    this.loadFailed.set(false);
    const stale = () => this.loadedId !== productId;
    await this.read(productId)
      .catch(() => stale() || this.loadFailed.set(true))
      .finally(() => stale() || this.loading.set(false));
  }
  retryLoad = () => this.load(this.loadedId);
  private async read(productId: string): Promise<void> {
    const detail = await this.api.read(productId);
    this.productId.set(detail.id);
    this.model.set({
      ...detail.form,
      type: detail.form.type ?? '',
      scent: detail.form.scent ?? '',
      hqOnHand: detail.hq.onHand,
    });
    this.revision = detail.revision;
    this.stock.set(detail.hq);
    this.stockDraft.set(detail.hq.onHand);
    const list = await this.api.listAliases(productId);
    this.aliases.set(list.aliases);
    try {
      const card = await this.api.cardState(productId);
      this.applyCard(card);
      // Reopening the product continues an unfinished card instead of leaving it "processing".
      if (card.status === 'UPLOADING' || card.status === 'GENERATING')
        void this.processUntilDone(productId, card.versionId);
    } catch (error) {
      if (code(error) !== 'NOT_FOUND') throw error;
      this.card.set(null);
    }
  }
  /** Saves the form; returns the product id on success. */
  async save(): Promise<string | null> {
    const { hqOnHand, ...draft } = this.model();
    const form: ProductForm = {
      ...draft,
      category: draft.category as ProductCategory,
      type: draft.type.trim() || null,
      scent: draft.scent.trim() || null,
    };
    this.saving.set(true);
    this.message.set(null);
    this.formKey ??= crypto.randomUUID();
    try {
      const id = this.productId();
      const detail = id
        ? await this.api.update({
            productId: id,
            expectedRevision: this.revision,
            form,
            idempotencyKey: this.formKey,
          })
        : await this.api.create({ form, hqOnHand, idempotencyKey: this.formKey });
      this.formKey = null;
      this.productId.set(detail.id);
      this.revision = detail.revision;
      this.stock.set(detail.hq);
      this.message.set({ key: 'hq.products.messages.saved' });
      return detail.id;
    } catch (error) {
      const c = code(error);
      if (c === 'STALE_STATE' && this.productId()) {
        this.formKey = null;
        // Refresh only the revision; the user's draft stays on screen.
        this.revision = (await this.api.read(this.productId()!)).revision;
        this.message.set({ key: 'hq.products.messages.stale' });
      } else if (c === 'VALIDATION_ERROR') {
        this.formKey = null;
        this.message.set({ key: 'hq.products.messages.invalid' });
      } else this.message.set({ key: 'hq.products.messages.unknown' });
      return null;
    } finally {
      this.saving.set(false);
    }
  }
  async saveStock(): Promise<void> {
    const id = this.productId();
    const current = this.stock();
    if (!id || !current) return;
    this.stockMessage.set(null);
    try {
      const next = await this.api.setHqStock({
        productId: id,
        expectedVersion: current.version,
        onHand: this.stockDraft(),
        idempotencyKey: crypto.randomUUID(),
      });
      this.stock.set(next);
      this.stockMessage.set({ key: 'hq.products.stock.saved' });
    } catch (error) {
      const c = code(error);
      if (c === 'STALE_STATE') {
        const fresh = (await this.api.read(id)).hq;
        this.stock.set(fresh);
        this.stockMessage.set({
          key: 'hq.products.stock.stale',
          params: { onHand: fresh.onHand, reserved: fresh.reserved },
        });
      } else
        this.stockMessage.set(
          c === 'VALIDATION_ERROR'
            ? { key: 'hq.products.stock.tooLow', params: { reserved: current.reserved } }
            : { key: 'hq.products.stock.failed' },
        );
    }
  }
  addAlias(phrase: string, kind: ProductAliasKind = this.newAliasKind()) {
    return this.changeAliases([{ op: 'add', phrase, kind }]);
  }
  editAlias(row: ProductAliasRow, phrase: string, kind: ProductAliasKind) {
    return this.changeAliases([
      { op: 'edit', aliasId: row.id, expectedRevision: row.revision, phrase, kind },
    ]);
  }
  removeAlias(row: ProductAliasRow) {
    return this.changeAliases([{ op: 'remove', aliasId: row.id, expectedRevision: row.revision }]);
  }
  retryAliases() {
    return this.pendingAliases ? this.sendAliases(this.pendingAliases) : Promise.resolve();
  }
  private changeAliases(changes: ProductAliasChange[]) {
    this.pendingAliases = { changes, key: crypto.randomUUID() };
    return this.sendAliases(this.pendingAliases);
  }
  private async sendAliases(pending: { changes: ProductAliasChange[]; key: string }) {
    const id = this.productId();
    if (!id) return;
    this.aliasMessage.set(null);
    try {
      const result = await this.api.saveAliases({
        productId: id,
        changes: pending.changes,
        idempotencyKey: pending.key,
      });
      this.pendingAliases = null;
      this.aliases.set(result.aliases);
      this.collisions.set(result.collisions);
    } catch (error) {
      const c = code(error);
      if (c === 'UNKNOWN') {
        this.aliasMessage.set({ key: 'hq.products.aliases.unknown' });
        return;
      }
      this.pendingAliases = null;
      if (c === 'STALE_STATE') this.aliases.set((await this.api.listAliases(id)).aliases);
      this.aliasMessage.set({
        key: c === 'STALE_STATE' ? 'hq.products.aliases.stale' : 'hq.products.aliases.invalid',
      });
    }
  }
  /**
   * Uploads the card, waits for extraction, then shows AI suggestions for HQ review.
   * With process=false it only registers and uploads; reopening the product resumes processing.
   */
  async attachCard(file: File, process = true): Promise<void> {
    const id = this.productId();
    if (!id) return;
    this.cardMessage.set(null);
    try {
      const attached = await this.api.attachCard(id, file, crypto.randomUUID());
      this.applyCard(attached);
      if (process) await this.processUntilDone(id, attached.versionId);
    } catch (error) {
      this.cardMessage.set(cardFailure(error));
    }
  }
  /** Retries a failed or interrupted card; the server replays each completed step. */
  retryCard(): Promise<void> {
    const id = this.productId();
    const card = this.card();
    return id && card ? this.processUntilDone(id, card.versionId) : Promise.resolve();
  }
  private async processUntilDone(productId: string, versionId: string): Promise<void> {
    this.cardMessage.set(null);
    try {
      const key = crypto.randomUUID();
      for (let attempt = 0; attempt < 60; attempt++) {
        try {
          this.applyCard(await this.api.processCard(productId, versionId, key));
          return;
        } catch (error) {
          if (code(error) !== 'IN_PROGRESS') throw error;
          await sleep(3000);
        }
      }
      this.cardMessage.set({ key: 'hq.products.card.stillProcessing' });
    } catch (error) {
      this.cardMessage.set(cardFailure(error));
    }
  }
  /** Saves a suggestion, optionally with HQ's edited phrase or kind, then drops it from the list. */
  async acceptSuggestion(
    suggestion: CardSuggestion,
    phrase = suggestion.phrase,
    kind = suggestion.kind,
  ): Promise<void> {
    await this.addAlias(phrase, kind);
    if (!this.aliasMessage()) this.rejectSuggestion(suggestion);
  }
  /** Accepts the reviewed suggestions in one alias save. */
  async acceptAll(items: { phrase: string; kind: ProductAliasKind }[]): Promise<void> {
    if (!items.length) return;
    await this.changeAliases(items.map(({ phrase, kind }) => ({ op: 'add', phrase, kind })));
    if (!this.aliasMessage()) this.suggestions.set([]);
  }
  rejectSuggestion(suggestion: CardSuggestion): void {
    this.suggestions.update((all) => all.filter((s) => s.phrase !== suggestion.phrase));
  }
  private applyCard(state: CardAttachmentState) {
    this.card.set(state);
    this.suggestions.set(state.suggestions);
  }
}
