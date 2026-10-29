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
  templateUrl: './product-knowledge-review.component.html',
  styleUrl: './product-knowledge-review.component.scss',
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
