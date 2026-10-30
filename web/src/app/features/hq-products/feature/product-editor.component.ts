import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { form, required, min, max, pattern, FormField } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import {
  productCategories,
  type ProductAliasKind,
  type ProductAliasRow,
} from '../../../../../../shared/contracts/product-admin/index';
import { PdfDropzone } from '../../../shared/ui/pdf-dropzone/pdf-dropzone';
import type { CardSuggestion } from '../models/card-suggestion';
import { ProductEditorFacade } from './product-editor.facade';

const kinds: { value: ProductAliasKind; label: string }[] = [
  { value: 'NAME', label: 'hq.products.aliases.kind.NAME' },
  { value: 'PHONETIC', label: 'hq.products.aliases.kind.PHONETIC' },
  { value: 'TYPE', label: 'hq.products.aliases.kind.TYPE' },
];
const sourceLabel = {
  HQ: 'hq.products.aliases.source.HQ',
  SEED: 'hq.products.aliases.source.SEED',
  DOCUMENT: 'hq.products.aliases.source.DOCUMENT',
} as const;

/** HQ add/edit product: fields, HQ quantity, product-owned aliases and the product card. */
@Component({
  selector: 'app-product-editor',
  providers: [ProductEditorFacade],
  imports: [
    FormField,
    TranslocoPipe,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    PageHeader,
    PdfDropzone,
  ],
  styleUrl: './product-editor.component.scss',
  templateUrl: './product-editor.component.html',
})
export class ProductEditorComponent implements OnInit {
  readonly facade = inject(ProductEditorFacade);
  private readonly router = inject(Router);
  /** Route parameter; absent on /hq/stock/products/new. */
  readonly productId = input<string>();
  readonly kinds = kinds;
  readonly categories = productCategories;
  /** Card chosen on the add screen; attached once the product exists. */
  readonly pendingCard = signal<File | null>(null);
  readonly attachedName = signal('');
  readonly cardBusy = computed(() => {
    const status = this.facade.card()?.status;
    return status === 'UPLOADING' || status === 'GENERATING';
  });
  readonly sourceLabel = sourceLabel;
  readonly cardStatus = {
    UPLOADING: 'hq.products.card.statusLabel.UPLOADING',
    GENERATING: 'hq.products.card.statusLabel.GENERATING',
    PUBLISHING: 'hq.products.card.statusLabel.PUBLISHING',
    PUBLISHED: 'hq.products.card.statusLabel.PUBLISHED',
    NEEDS_REVIEW: 'hq.products.card.statusLabel.NEEDS_REVIEW',
    FAILED: 'hq.products.card.statusLabel.FAILED',
  } as const;
  readonly newAlias = signal('');
  readonly editingId = signal<string | null>(null);
  readonly editPhrase = signal('');
  readonly editKind = signal<ProductAliasKind>('NAME');
  readonly suggestionEdits = new Map<string, string>();
  readonly suggestionKinds = new Map<string, ProductAliasKind>();
  readonly aliasGroups = computed(() =>
    kinds
      .map((k) => ({
        kind: k.value,
        aliases: this.facade.aliases().filter((a) => a.kind === k.value),
      }))
      .filter((g) => g.aliases.length),
  );
  startEdit(alias: ProductAliasRow) {
    this.editingId.set(alias.id);
    this.editPhrase.set(alias.phrase);
    this.editKind.set(alias.kind);
  }
  async saveEdit(alias: ProductAliasRow) {
    await this.facade.editAlias(alias, this.editPhrase().trim(), this.editKind());
    if (!this.facade.aliasMessage()) this.editingId.set(null);
  }
  suggestionText(s: CardSuggestion) {
    return this.suggestionEdits.get(s.phrase) ?? s.phrase;
  }
  suggestionKind(s: CardSuggestion) {
    return this.suggestionKinds.get(s.phrase) ?? s.kind;
  }
  acceptSuggestion(s: CardSuggestion) {
    const phrase = this.suggestionText(s).trim();
    return phrase
      ? this.facade.acceptSuggestion(s, phrase, this.suggestionKind(s))
      : Promise.resolve();
  }
  acceptAll() {
    return this.facade.acceptAll(
      this.facade
        .suggestions()
        .map((s) => ({ phrase: this.suggestionText(s).trim(), kind: this.suggestionKind(s) }))
        .filter((s) => s.phrase),
    );
  }
  readonly fields = form(this.facade.model, (p) => {
    required(p.category);
    for (const field of [p.name, p.brand, p.summary, p.sourceCode, p.sourceUrl, p.observedOn])
      required(field);
    min(p.netContentMl, 1);
    min(p.retailPriceGrosz, 0);
    min(p.hqOnHand, 0);
    max(p.hqOnHand, 2147483647);
    pattern(p.sourceUrl, /^https:\/\/\S+$/);
  });
  readonly kindLabel = (kind: ProductAliasKind) => kinds.find((k) => k.value === kind)!.label;
  ngOnInit(): void {
    const id = this.productId();
    if (id) void this.facade.load(id);
    else this.facade.startNew();
  }
  async saveProduct() {
    const wasNew = !this.facade.productId();
    const id = await this.facade.save();
    if (!id || !wasNew) return;
    const card = this.pendingCard();
    // Upload only; the product screen resumes processing and shows suggestions.
    if (card) await this.facade.attachCard(card, false);
    await this.router.navigate(['/hq/stock/products', id]);
  }
  async addAlias() {
    await this.facade.addAlias(this.newAlias().trim());
    if (!this.facade.aliasMessage()) this.newAlias.set('');
  }
  pickPendingCard(files: FileList) {
    this.pendingCard.set(files[0] ?? null);
  }
  attach(files: FileList) {
    const file = files[0];
    if (!file) return;
    this.attachedName.set(file.name);
    void this.facade.attachCard(file);
  }
}
