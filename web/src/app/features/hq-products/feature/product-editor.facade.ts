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
import {
  ProductAdminApi,
  ProductAdminError,
  type CardAttachmentState,
  type CardSuggestion,
} from '../data-access/product-admin-api';

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
  readonly message = signal('');
  private revision = 0;
  private formKey: string | null = null;

  readonly stock = signal<HqStock | null>(null);
  readonly stockDraft = signal(0);
  readonly stockMessage = signal('');

  readonly aliases = signal<ProductAliasRow[]>([]);
  readonly collisions = signal<ProductAliasesResult['collisions']>([]);
  readonly newAliasKind = signal<ProductAliasKind>('NAME');
  readonly aliasMessage = signal('');
  private pendingAliases: { changes: ProductAliasChange[]; key: string } | null = null;

  readonly card = signal<CardAttachmentState | null>(null);
  readonly suggestions = signal<CardSuggestion[]>([]);
  readonly cardMessage = signal('');

  startNew(): void {
    this.productId.set(null);
    this.model.set(emptyDraft());
    this.revision = 0;
    this.formKey = null;
  }
  async load(productId: string): Promise<void> {
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
    this.message.set('');
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
      this.message.set('Product saved.');
      return detail.id;
    } catch (error) {
      const c = code(error);
      if (c === 'STALE_STATE' && this.productId()) {
        this.formKey = null;
        // Refresh only the revision; the user's draft stays on screen.
        this.revision = (await this.api.read(this.productId()!)).revision;
        this.message.set('Someone else changed this product. Your edits are kept; save again.');
      } else if (c === 'VALIDATION_ERROR') {
        this.formKey = null;
        this.message.set('Check the fields. The product code must be unique.');
      } else this.message.set('The outcome is unknown. Save again to confirm.');
      return null;
    } finally {
      this.saving.set(false);
    }
  }
  async saveStock(): Promise<void> {
    const id = this.productId();
    const current = this.stock();
    if (!id || !current) return;
    this.stockMessage.set('');
    try {
      const next = await this.api.setHqStock({
        productId: id,
        expectedVersion: current.version,
        onHand: this.stockDraft(),
        idempotencyKey: crypto.randomUUID(),
      });
      this.stock.set(next);
      this.stockMessage.set('HQ quantity saved.');
    } catch (error) {
      const c = code(error);
      if (c === 'STALE_STATE') {
        const fresh = (await this.api.read(id)).hq;
        this.stock.set(fresh);
        this.stockMessage.set(
          `Stock changed meanwhile (on hand ${fresh.onHand}, reserved ${fresh.reserved}). Enter the quantity again.`,
        );
      } else
        this.stockMessage.set(
          c === 'VALIDATION_ERROR'
            ? `The quantity cannot be lower than reserved (${current.reserved}).`
            : 'The quantity could not be saved. Try again.',
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
    this.aliasMessage.set('');
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
        this.aliasMessage.set('The outcome is unknown. Retry to confirm.');
        return;
      }
      this.pendingAliases = null;
      if (c === 'STALE_STATE') this.aliases.set((await this.api.listAliases(id)).aliases);
      this.aliasMessage.set(
        c === 'STALE_STATE'
          ? 'Aliases changed meanwhile. The list was reloaded.'
          : 'Check the phrase. A product can have at most 32 own aliases.',
      );
    }
  }
  /**
   * Uploads the card, waits for extraction, then shows AI suggestions for HQ review.
   * With process=false it only registers and uploads; reopening the product resumes processing.
   */
  async attachCard(file: File, process = true): Promise<void> {
    const id = this.productId();
    if (!id) return;
    this.cardMessage.set('');
    try {
      const attached = await this.api.attachCard(id, file, crypto.randomUUID());
      this.applyCard(attached);
      if (process) await this.processUntilDone(id, attached.versionId);
    } catch (error) {
      this.cardMessage.set(
        code(error) === 'RATE_LIMITED'
          ? 'The shared AI limit has been reached. Try again later.'
          : 'The card could not be processed. Try again.',
      );
    }
  }
  /** Retries a failed or interrupted card; the server replays each completed step. */
  retryCard(): Promise<void> {
    const id = this.productId();
    const card = this.card();
    return id && card ? this.processUntilDone(id, card.versionId) : Promise.resolve();
  }
  private async processUntilDone(productId: string, versionId: string): Promise<void> {
    this.cardMessage.set('');
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
      this.cardMessage.set('The card is still processing. Reopen this product later.');
    } catch (error) {
      this.cardMessage.set(
        code(error) === 'RATE_LIMITED'
          ? 'The shared AI limit has been reached. Try again later.'
          : 'The card could not be processed. Try again.',
      );
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
