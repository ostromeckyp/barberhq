import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
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
  { value: 'NAME', label: 'Name' },
  { value: 'PHONETIC', label: 'Pronunciation' },
  { value: 'TYPE', label: 'Type' },
];
const sourceLabel = { HQ: 'Manual', SEED: 'Seed', DOCUMENT: 'From document' } as const;

/** HQ add/edit product: fields, HQ quantity, product-owned aliases and the product card. */
@Component({
  selector: 'app-product-editor',
  providers: [ProductEditorFacade],
  imports: [
    FormField,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    PageHeader,
    PdfDropzone,
  ],
  styles: `
    :host {
      display: block;
      max-width: 880px;
    }
    section.card {
      margin-block: 16px;
      min-width: 0;
      padding: 16px 20px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
    }
    section.card h2 {
      margin-top: 0;
      font-size: 18px;
    }
    .alias-edit {
      flex-wrap: wrap;
    }
    .alias-edit mat-form-field {
      flex: 1 1 180px;
      min-width: 0;
    }
    .alias-edit mat-form-field.kind {
      flex: 0 1 160px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 0 16px;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .row mat-form-field {
      flex: 1 1 200px;
      min-width: 0;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    li {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 65px;
      padding: 4px 0;
      border-bottom: 1px solid var(--divider);
      overflow-wrap: anywhere;
    }
    h3 {
      margin: 16px 0 4px;
      font-size: 14px;
    }
    .suggestions-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 16px;
    }
    .suggestions-head h3 {
      margin: 0;
    }
    li.suggestion {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 4px 12px;
      padding: 12px 0;
    }
    .suggestion-fields {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      min-width: 0;
    }
    .suggestion-fields mat-form-field {
      flex: 1 1 220px;
      min-width: 0;
    }
    .suggestion-fields mat-form-field.kind {
      flex: 0 1 160px;
    }
    .suggestion-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .collision {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0;
      font-size: 12px;
      color: var(--warning-text);
    }
    .collision mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
    }
    @media (max-width: 599px) {
      li.suggestion {
        grid-template-columns: minmax(0, 1fr);
      }
      .suggestion-actions {
        justify-content: flex-end;
      }
    }
    li .phrase {
      flex: 1;
      min-width: 0;
    }
    .badge {
      font-size: 0.75rem;
      opacity: 0.75;
      white-space: nowrap;
    }
    .warning {
      color: var(--warn, #8a4b00);
      overflow-wrap: anywhere;
    }
  `,
  template: `
    <app-page-header
      eyebrow="HQ WORKSPACE"
      [title]="productId() || facade.productId() ? 'Edit product' : 'Add product'"
      description="Catalog details, HQ quantity and the phrases the ordering assistant understands."
    >
      <a mat-stroked-button routerLink="/hq/stock">Back to HQ stock</a>
    </app-page-header>

    <section class="card" aria-labelledby="product-details">
      <h2 id="product-details">Product details</h2>
      <form class="grid" (submit)="$event.preventDefault(); saveProduct()">
        <mat-form-field appearance="outline"
          ><mat-label>Name</mat-label><input matInput [formField]="fields.name"
        /></mat-form-field>
        <mat-form-field appearance="outline"
          ><mat-label>Brand</mat-label><input matInput [formField]="fields.brand"
        /></mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Category</mat-label>
          <mat-select aria-label="Category" [formField]="fields.category">
            @for (c of categories; track c) {
              <mat-option [value]="c">{{ c }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline"
          ><mat-label>Type (optional)</mat-label><input matInput [formField]="fields.type"
        /></mat-form-field>
        <mat-form-field appearance="outline"
          ><mat-label>Product code</mat-label><input matInput [formField]="fields.sourceCode"
        /></mat-form-field>
        <mat-form-field appearance="outline"
          ><mat-label>Net content (ml)</mat-label
          ><input matInput type="number" [formField]="fields.netContentMl"
        /></mat-form-field>
        <mat-form-field appearance="outline"
          ><mat-label>Retail price (grosz)</mat-label
          ><input matInput type="number" [formField]="fields.retailPriceGrosz"
        /></mat-form-field>
        <mat-form-field appearance="outline"
          ><mat-label>Scent (optional)</mat-label><input matInput [formField]="fields.scent"
        /></mat-form-field>
        <mat-form-field appearance="outline"
          ><mat-label>Source URL</mat-label><input matInput [formField]="fields.sourceUrl"
        /></mat-form-field>
        <mat-form-field appearance="outline"
          ><mat-label>Observed on</mat-label
          ><input matInput type="date" [formField]="fields.observedOn"
        /></mat-form-field>
        <mat-form-field appearance="outline" style="grid-column: 1 / -1"
          ><mat-label>Description</mat-label
          ><textarea matInput rows="3" [formField]="fields.summary"></textarea>
        </mat-form-field>
        @if (!facade.productId()) {
          <mat-form-field appearance="outline"
            ><mat-label>HQ quantity</mat-label
            ><input matInput type="number" [formField]="fields.hqOnHand"
          /></mat-form-field>
        }
        @if (!facade.productId()) {
          <div style="grid-column: 1 / -1">
            <h3>Product card (optional)</h3>
            <p>The PDF is attached after the product is added; AI then suggests aliases from it.</p>
            <app-pdf-dropzone
              label="Product card PDF"
              [fileName]="pendingCard()?.name ?? ''"
              [disabled]="facade.saving()"
              (filesSelected)="pickPendingCard($event)"
            />
          </div>
        }
        <div class="row" style="grid-column: 1 / -1">
          <button mat-flat-button type="submit" [disabled]="facade.saving() || fields().invalid()">
            {{ facade.productId() ? 'Save product' : 'Add product' }}
          </button>
          @if (facade.message()) {
            <span role="status">{{ facade.message() }}</span>
          }
        </div>
      </form>
    </section>

    @if (facade.productId() && facade.stock(); as stock) {
      <section class="card" aria-labelledby="hq-quantity">
        <h2 id="hq-quantity">HQ quantity</h2>
        <p>
          Reserved for salon deliveries: {{ stock.reserved }} · Available: {{ stock.available }}
        </p>
        <div class="row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>On hand at HQ</mat-label>
            <input
              matInput
              type="number"
              min="0"
              [value]="facade.stockDraft()"
              (input)="facade.stockDraft.set($any($event.target).valueAsNumber)"
            />
          </mat-form-field>
          <button mat-stroked-button (click)="facade.saveStock()">Save quantity</button>
        </div>
        @if (facade.stockMessage()) {
          <p role="status">{{ facade.stockMessage() }}</p>
        }
      </section>

      <section class="card" aria-labelledby="product-aliases">
        <h2 id="product-aliases">Aliases</h2>
        <p>
          How people name this product when ordering. Pronunciation covers how a foreign name sounds
          in Polish.
        </p>
        @for (group of aliasGroups(); track group.kind) {
          <h3 class="kind">{{ kindLabel(group.kind) }}</h3>
          <ul>
            @for (alias of group.aliases; track alias.id) {
              <li>
                @if (editingId() === alias.id) {
                  <div class="row alias-edit phrase">
                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                      <mat-label>Phrase</mat-label>
                      <input
                        matInput
                        [attr.aria-label]="'Edit phrase ' + alias.phrase"
                        [value]="editPhrase()"
                        (input)="editPhrase.set($any($event.target).value)"
                      />
                    </mat-form-field>
                    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="kind">
                      <mat-label>Kind</mat-label>
                      <mat-select
                        [aria-label]="'Edit kind ' + alias.phrase"
                        [value]="editKind()"
                        (valueChange)="editKind.set($event)"
                      >
                        @for (k of kinds; track k.value) {
                          <mat-option [value]="k.value">{{ k.label }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  </div>
                  <button
                    mat-button
                    [attr.aria-label]="'Save alias ' + alias.phrase"
                    [disabled]="!editPhrase().trim()"
                    (click)="saveEdit(alias)"
                  >
                    Save
                  </button>
                  <button mat-button (click)="editingId.set(null)">Cancel</button>
                } @else {
                  <span class="phrase">{{ alias.phrase }}</span>
                  <span class="badge">{{ sourceLabel[alias.source] }}</span>
                  @if (alias.editable) {
                    <button
                      mat-icon-button
                      [attr.aria-label]="'Edit alias ' + alias.phrase"
                      (click)="startEdit(alias)"
                    >
                      <mat-icon aria-hidden="true">edit</mat-icon>
                    </button>
                    <button
                      mat-icon-button
                      [attr.aria-label]="'Remove alias ' + alias.phrase"
                      (click)="facade.removeAlias(alias)"
                    >
                      <mat-icon aria-hidden="true">delete</mat-icon>
                    </button>
                  }
                }
              </li>
            }
          </ul>
        } @empty {
          <p>No aliases yet.</p>
        }
        <div class="row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>New alias</mat-label>
            <input
              matInput
              [value]="newAlias()"
              (input)="newAlias.set($any($event.target).value)"
            />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic" style="flex: 0 1 180px">
            <mat-label>Kind</mat-label>
            <mat-select
              [value]="facade.newAliasKind()"
              (valueChange)="facade.newAliasKind.set($event)"
            >
              @for (k of kinds; track k.value) {
                <mat-option [value]="k.value">{{ k.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <button mat-stroked-button [disabled]="!newAlias().trim()" (click)="addAlias()">
            Add alias
          </button>
        </div>
        @for (c of facade.collisions(); track c.phrase) {
          <p class="warning" role="status">
            “{{ c.phrase }}” also matches: {{ c.productNames.join(', ') }}
          </p>
        }
        @if (facade.aliasMessage()) {
          <p role="alert">
            {{ facade.aliasMessage() }}
            <button mat-button (click)="facade.retryAliases()">Retry</button>
          </p>
        }
      </section>

      <section class="card" aria-labelledby="product-card">
        <h2 id="product-card">Product card</h2>
        <p>
          Attach the product card PDF. AI suggests aliases from it; the card is published to the
          document library.
        </p>
        <app-pdf-dropzone
          label="Product card PDF"
          [fileName]="attachedName()"
          [disabled]="cardBusy()"
          (filesSelected)="attach($event)"
        />
        @if (facade.card(); as card) {
          <p role="status">Card status: {{ cardStatus[card.status] }}</p>
        }
        @if (facade.suggestions().length) {
          <div class="suggestions-head">
            <h3>Suggested from the card ({{ facade.suggestions().length }})</h3>
            <button mat-flat-button aria-label="Accept all suggestions" (click)="acceptAll()">
              Accept all
            </button>
          </div>
          <p class="muted">
            Edit a phrase or its kind before accepting. Rejected ones are not saved.
          </p>
          <ul>
            @for (s of facade.suggestions(); track s.phrase) {
              <li class="suggestion">
                <div class="suggestion-fields">
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Phrase</mat-label>
                    <input
                      matInput
                      [attr.aria-label]="'Suggested phrase ' + s.phrase"
                      [value]="suggestionText(s)"
                      (input)="suggestionEdits.set(s.phrase, $any($event.target).value)"
                    />
                  </mat-form-field>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="kind">
                    <mat-label>Kind</mat-label>
                    <mat-select
                      [aria-label]="'Suggested kind ' + s.phrase"
                      [value]="suggestionKind(s)"
                      (valueChange)="suggestionKinds.set(s.phrase, $event)"
                    >
                      @for (k of kinds; track k.value) {
                        <mat-option [value]="k.value">{{ k.label }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                </div>
                <div class="suggestion-actions">
                  <button
                    mat-stroked-button
                    [attr.aria-label]="'Accept ' + s.phrase"
                    (click)="acceptSuggestion(s)"
                  >
                    Accept
                  </button>
                  <button
                    mat-icon-button
                    [attr.aria-label]="'Reject ' + s.phrase"
                    (click)="facade.rejectSuggestion(s)"
                  >
                    <mat-icon aria-hidden="true">close</mat-icon>
                  </button>
                </div>
                @if (s.collisions.length) {
                  <p class="collision">
                    <mat-icon aria-hidden="true">warning</mat-icon>Also matches
                    {{ s.collisions.join(', ') }}
                  </p>
                }
              </li>
            }
          </ul>
        }
        @if (facade.cardMessage() || facade.card()?.status === 'FAILED') {
          <p role="alert">
            {{ facade.cardMessage() || 'The card could not be processed.' }}
            <button mat-button (click)="facade.retryCard()">Retry processing</button>
          </p>
        }
      </section>
    }
  `,
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
    UPLOADING: 'Processing the PDF…',
    GENERATING: 'Suggesting aliases…',
    PUBLISHING: 'Publishing in the background',
    PUBLISHED: 'Published',
    NEEDS_REVIEW: 'Needs document review (aliases are still usable)',
    FAILED: 'Failed — attach again',
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
