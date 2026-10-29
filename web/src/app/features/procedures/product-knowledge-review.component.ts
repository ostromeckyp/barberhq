import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type { KnowledgePassageRef } from '../../../../../shared/contracts/product-knowledge/index';
import { ProductKnowledgeReviewFacade } from './library/product-knowledge-review.facade';
@Component({
  selector: 'app-product-knowledge-review',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: ` <section class="product-review" aria-labelledby="product-review-title">
    <h2 id="product-review-title">Product knowledge</h2>
    <p>
      Link exact PDF passages to catalog products. Generated aliases stay proposals until HQ reviews
      them and publishes this PDF.
    </p>
    @if (facade.workspace(); as workspace) {
      @if (workspace.readOnly) {
        <p role="status">This version is read-only. Use Replace PDF to enrich the next version.</p>
      }
      @if (!workspace.readOnly) {
        <fieldset [disabled]="facade.blocked()" class="passage-editor">
          <legend>Link a source passage</legend>
          <mat-form-field appearance="outline"
            ><mat-label>Source chunk</mat-label
            ><mat-select
              [value]="chunkId()"
              [disabled]="facade.blocked()"
              (selectionChange)="chooseChunk($event.value)"
            >
              @for (p of workspace.passages; track p.ref.chunkId) {
                <mat-option [value]="p.ref.chunkId"
                  >Page {{ p.physicalPage }} · {{ p.text.slice(0, 65) }}</mat-option
                >
              }
            </mat-select></mat-form-field
          >
          @if (chunk(); as source) {
            <pre class="source">{{ source.text }}</pre>
            <button
              mat-button
              type="button"
              [disabled]="facade.blocked()"
              (click)="useWholeChunk()"
            >
              Use whole chunk
            </button>
            <mat-form-field appearance="outline"
              ><mat-label>Exact excerpt from this chunk</mat-label
              ><textarea
                matInput
                #excerptInput
                [value]="excerpt()"
                [disabled]="facade.blocked()"
                (input)="setExcerpt(excerptInput.value)"
                rows="3"
              ></textarea>
            </mat-form-field>
            @if (occurrences().length > 1) {
              <p>This excerpt occurs {{ occurrences().length }} times. Choose its occurrence.</p>
              @for (start of occurrences(); track start; let index = $index) {
                <button
                  mat-stroked-button
                  type="button"
                  [disabled]="facade.blocked()"
                  [attr.aria-pressed]="occurrence() === start"
                  (click)="occurrence.set(start)"
                >
                  Occurrence {{ index + 1 }} · {{ start }}
                </button>
              }
            }
            @if (excerpt() && !occurrences().length) {
              <p class="error">Paste an exact excerpt from the selected chunk.</p>
            }
            <mat-form-field appearance="outline"
              ><mat-label>Catalog product</mat-label
              ><mat-select
                [value]="productId()"
                [disabled]="facade.blocked()"
                (selectionChange)="productId.set($event.value)"
              >
                @for (p of workspace.catalog; track p.id) {
                  <mat-option [value]="p.id">{{ p.name }} · {{ p.sourceCode }}</mat-option>
                }
              </mat-select></mat-form-field
            >
            <div class="actions">
              <button
                mat-stroked-button
                type="button"
                [disabled]="!selectedPassage() || !productId() || facade.blocked()"
                (click)="link()"
              >
                Link selected passage</button
              ><button
                mat-button
                type="button"
                [disabled]="!selectedPassage() || facade.blocked() || facade.dirty()"
                (click)="suggest()"
              >
                Suggest product
              </button>
            </div>
          }
        </fieldset>
      }
      <p>
        Changing or unconfirming a product removes proposals without another confirmed source
        passage.
      </p>
      @for (link of workspace.review.links; track link.id) {
        <article class="link">
          <h3>
            Source · page {{ page(link.passage) }} <span class="origin">{{ link.method }}</span>
          </h3>
          <pre>{{ text(link.passage) }}</pre>
          @if (link.candidateProductIds?.length) {
            <p>
              Suggested:
              @for (id of link.candidateProductIds; track id) {
                <span>{{ name(id) }} </span>
              }
            </p>
          }
          <mat-form-field appearance="outline"
            ><mat-label>Linked product</mat-label
            ><mat-select
              [value]="link.productId"
              [disabled]="facade.blocked()"
              (selectionChange)="facade.changeLink(link.id, $event.value, false)"
            >
              @for (p of workspace.catalog; track p.id) {
                <mat-option [value]="p.id">{{ p.name }} · {{ p.sourceCode }}</mat-option>
              }
            </mat-select></mat-form-field
          >
          <div class="actions">
            <mat-checkbox
              [checked]="link.confirmed"
              [disabled]="facade.blocked() || !link.productId"
              (change)="facade.changeLink(link.id, link.productId ?? '', $event.checked)"
              >Confirm this product and passage</mat-checkbox
            ><button
              mat-button
              type="button"
              [disabled]="facade.blocked()"
              (click)="facade.removeLink(link.id)"
            >
              Remove link
            </button>
          </div>
        </article>
      }
      @for (id of facade.confirmedProducts(); track id) {
        <article class="profile">
          <h3>{{ name(id) }}</h3>
          <p>
            Current type: <strong>{{ currentType(id) || 'None' }}</strong> → Proposed:
            <strong>{{ profileType(id) || 'No new assertion' }}</strong>
          </p>
          <mat-form-field appearance="outline"
            ><mat-label>Proposed type (optional)</mat-label
            ><input
              matInput
              #typeInput
              maxlength="80"
              [value]="profileType(id)"
              [disabled]="facade.blocked()"
              (input)="facade.setType(id, typeInput.value)"
          /></mat-form-field>
          <button
            mat-stroked-button
            type="button"
            [disabled]="facade.blocked() || facade.dirty()"
            (click)="facade.generate(id)"
          >
            Generate aliases for this product
          </button>
          @for (alias of profileAliases(id); track alias.id) {
            <div class="alias-row">
              <mat-form-field appearance="outline"
                ><mat-label>Alias phrase</mat-label
                ><input
                  matInput
                  #phrase
                  maxlength="240"
                  [value]="alias.phrase"
                  [disabled]="facade.blocked()"
                  (input)="
                    facade.editAlias(id, alias.id, { phrase: phrase.value, decision: 'pending' })
                  "
              /></mat-form-field>
              <mat-form-field appearance="outline"
                ><mat-label>Kind</mat-label
                ><mat-select
                  [value]="alias.kind"
                  [disabled]="facade.blocked()"
                  (selectionChange)="
                    facade.editAlias(id, alias.id, { kind: $event.value, decision: 'pending' })
                  "
                  ><mat-option value="name">Name</mat-option
                  ><mat-option value="type">Type</mat-option
                  ><mat-option value="phonetic">Phonetic</mat-option></mat-select
                ></mat-form-field
              >
              <mat-form-field appearance="outline"
                ><mat-label>Language</mat-label
                ><mat-select
                  [value]="alias.lang"
                  [disabled]="facade.blocked()"
                  (selectionChange)="
                    facade.editAlias(id, alias.id, { lang: $event.value, decision: 'pending' })
                  "
                  ><mat-option value="pl">Polish</mat-option
                  ><mat-option value="en">English</mat-option></mat-select
                ></mat-form-field
              >
              <mat-form-field appearance="outline"
                ><mat-label>Decision</mat-label
                ><mat-select
                  [value]="alias.decision"
                  [disabled]="facade.blocked()"
                  (selectionChange)="facade.editAlias(id, alias.id, { decision: $event.value })"
                  ><mat-option value="pending">Pending review</mat-option
                  ><mat-option value="accepted">Accept</mat-option
                  ><mat-option value="rejected">Reject</mat-option></mat-select
                ></mat-form-field
              ><small>{{ alias.source }}</small>
            </div>
          }
          <button
            mat-button
            type="button"
            [disabled]="facade.blocked()"
            (click)="facade.addAlias(id)"
          >
            Add alias manually
          </button>
        </article>
      }
      @if (workspace.review.unlinkedPassages.length) {
        <h3>Unlinked passages</h3>
        <p>
          Save new links first to refresh these ranges. Acknowledge every passage left without
          product knowledge.
        </p>
        @for (ref of workspace.review.unlinkedPassages; track key(ref)) {
          <div class="unlinked">
            <pre>Page {{ page(ref) }} · {{ text(ref) }}</pre>
            <mat-checkbox
              [checked]="acknowledged(ref)"
              [disabled]="facade.blocked()"
              (change)="facade.acknowledge(ref, $event.checked)"
              >Leave this passage unlinked</mat-checkbox
            >
          </div>
        }
      }
      @if (workspace.kind !== 'product-card') {
        <mat-checkbox
          [checked]="workspace.review.emptyKnowledgeAcknowledged"
          [disabled]="facade.blocked()"
          (change)="facade.acknowledgeEmpty($event.checked)"
          >This catalog intentionally adds no product knowledge</mat-checkbox
        >
      }
      <h3>Collision impact</h3>
      @if (workspace.review.impact.length) {
        <ul>
          @for (impact of workspace.review.impact; track impact.normalized) {
            <li>
              <strong>{{ impact.normalized }}</strong
              >: {{ impact.beforeProductIds.length }} → {{ impact.afterProductIds.length }} products
              @if (impact.collision) {
                <span> · Ambiguous; requires clarification</span>
              }
            </li>
          }
        </ul>
      } @else {
        <p>No accepted alias changes. Save draft to calculate current impact.</p>
      }
      @if (!workspace.readOnly) {
        <div class="actions">
          <button
            mat-stroked-button
            type="button"
            [disabled]="facade.blocked()"
            (click)="facade.save()"
          >
            Save draft and refresh impact</button
          ><button
            mat-flat-button
            type="button"
            data-testid="accept-review"
            [disabled]="!facade.canAccept()"
            (click)="facade.accept()"
          >
            Accept product review
          </button>
        </div>
        @if (facade.dirty()) {
          <p>Save draft before generating or accepting knowledge.</p>
        }
        @if (facade.ready()) {
          <p role="status">Product review accepted. Publish the PDF below to activate it.</p>
        }
      }
    }
    @if (facade.error()) {
      <p role="alert" class="error">{{ facade.error() }}</p>
    }
    @if (facade.pending() && !facade.busy()) {
      <button mat-stroked-button type="button" (click)="facade.retry()">
        Retry same product action
      </button>
    }
    <button
      mat-button
      type="button"
      [disabled]="facade.busy() || (facade.dirty() && !facade.conflict()) || !!facade.pending()"
      (click)="facade.refresh()"
    >
      {{
        facade.conflict()
          ? 'Reload latest product review and discard local edits'
          : 'Reload product review'
      }}
    </button>
  </section>`,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .product-review {
      border-top: 1px solid var(--mat-sys-outline-variant, #ddd);
      margin-top: 32px;
      padding-top: 24px;
      min-width: 0;
    }
    h2,
    h3 {
      margin: 0 0 12px;
    }
    p {
      line-height: 1.5;
    }
    fieldset,
    .link,
    .profile,
    .unlinked {
      min-width: 0;
      border: 1px solid var(--mat-sys-outline-variant, #ddd);
      border-radius: 12px;
      padding: 20px;
      margin: 16px 0;
    }
    mat-form-field {
      display: block;
      min-width: 0;
      width: 100%;
    }
    pre {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font: inherit;
      line-height: 1.5;
      max-height: 280px;
      overflow: auto;
    }
    .alias-row {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1.3fr;
      gap: 12px;
      align-items: start;
      margin-top: 20px;
    }
    .alias-row small {
      grid-column: 1/-1;
    }
    .actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .origin {
      font-size: 12px;
      font-weight: 500;
    }
    .error {
      color: var(--mat-sys-error, #b00020);
    }
    button {
      max-width: 100%;
      white-space: normal;
      height: auto;
      min-height: 40px;
    }
    mat-checkbox {
      max-width: 100%;
    }
    @media (max-width: 680px) {
      fieldset,
      .link,
      .profile,
      .unlinked {
        padding: 12px;
      }
      .alias-row {
        grid-template-columns: 1fr;
      }
      .actions {
        align-items: stretch;
        flex-direction: column;
      }
    }
  `,
})
export class ProductKnowledgeReviewComponent {
  readonly facade = inject(ProductKnowledgeReviewFacade);
  readonly versionId = input.required<string>();
  readonly disabled = input(false);
  readonly chunkId = signal('');
  readonly excerpt = signal('');
  readonly occurrence = signal<number | null>(null);
  readonly productId = signal('');
  readonly chunk = computed(() =>
    this.facade.workspace()?.passages.find((p) => p.ref.chunkId === this.chunkId()),
  );
  readonly occurrences = computed(() => {
    const source = this.chunk()?.text,
      excerpt = this.excerpt();
    if (!source || !excerpt) return [];
    const starts: number[] = [];
    for (let at = source.indexOf(excerpt); at >= 0; at = source.indexOf(excerpt, at + 1)) {
      starts.push(at);
    }
    return starts;
  });
  readonly selectedPassage = computed(() => {
    const starts = this.occurrences();
    const start = starts.length === 1 ? starts[0] : this.occurrence();
    return start !== null && starts.includes(start)
      ? { chunkId: this.chunkId(), start, end: start + this.excerpt().length }
      : null;
  });
  constructor() {
    effect(() => {
      const current = this.facade.workspace();
      if (!current) {
        this.chunkId.set('');
        this.excerpt.set('');
        this.occurrence.set(null);
        this.productId.set('');
      }
    });
    effect(() => {
      this.facade.frozen.set(this.disabled());
      void this.facade.open(this.versionId());
    });
  }
  chooseChunk(id: string) {
    this.chunkId.set(id);
    this.setExcerpt('');
  }
  setExcerpt(text: string) {
    this.excerpt.set(text);
    this.occurrence.set(null);
  }
  useWholeChunk() {
    this.setExcerpt(this.chunk()?.text ?? '');
  }
  link() {
    const ref = this.selectedPassage();
    if (ref && this.productId()) this.facade.link(ref, this.productId());
  }
  async suggest() {
    const ref = this.selectedPassage();
    if (ref) await this.facade.suggest(ref);
  }
  key(ref: KnowledgePassageRef) {
    return JSON.stringify([ref.chunkId, ref.start, ref.end]);
  }
  page(ref: KnowledgePassageRef) {
    return this.facade.workspace()?.passages.find((p) => p.ref.chunkId === ref.chunkId)
      ?.physicalPage;
  }
  text(ref: KnowledgePassageRef) {
    return (
      this.facade
        .workspace()
        ?.passages.find((p) => p.ref.chunkId === ref.chunkId)
        ?.text.slice(ref.start, ref.end) ?? ''
    );
  }
  name(id: string) {
    return this.facade.workspace()?.catalog.find((p) => p.id === id)?.name ?? id;
  }
  currentType(id: string) {
    return this.facade.workspace()?.catalog.find((p) => p.id === id)?.type;
  }
  profileType(id: string) {
    return this.facade.review()?.profiles.find((p) => p.productId === id)?.type ?? '';
  }
  profileAliases(id: string) {
    return this.facade.review()?.profiles.find((p) => p.productId === id)?.aliases ?? [];
  }
  acknowledged(ref: KnowledgePassageRef) {
    return (
      this.facade
        .review()
        ?.acknowledgedUnlinkedPassages.some((p) => this.key(p) === this.key(ref)) ?? false
    );
  }
}
