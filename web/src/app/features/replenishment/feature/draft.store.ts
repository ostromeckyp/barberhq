import { Service, signal, computed } from '@angular/core';
import type { DraftLine, ReadyDraftLine } from '../../../../../../shared/contracts/draft';
@Service({ autoProvided: false })
export class DraftStore {
  private readonly value = signal<DraftLine[]>([]);
  readonly lines = this.value.asReadonly();
  readonly canSubmit = computed(
    () =>
      this.lines().length > 0 &&
      this.lines().every(
        (line) =>
          line.status === 'READY' &&
          Number.isInteger(line.quantity) &&
          line.quantity >= 1 &&
          line.quantity <= 99,
      ),
  );
  add(line: ReadyDraftLine) {
    this.merge([line]);
  }
  merge(lines: DraftLine[]) {
    this.value.update((current) => {
      const next = [...current];
      for (const line of lines) {
        const index =
          line.status === 'READY'
            ? next.findIndex((x) => x.status === 'READY' && x.productId === line.productId)
            : -1;
        const existing = next[index];
        if (existing?.status === 'READY' && line.status === 'READY')
          next[index] = { ...existing, quantity: existing.quantity + line.quantity };
        else if (next.length < 6) next.push({ ...line });
      }
      return next;
    });
  }
  editQuantity(lineId: string, quantity: number) {
    this.value.update((lines) =>
      lines.map((line) => (line.lineId === lineId ? { ...line, quantity } : line)),
    );
  }
  remove(lineId: string) {
    this.value.update((lines) => lines.filter((line) => line.lineId !== lineId));
  }
  clear() {
    this.value.set([]);
  }
}
