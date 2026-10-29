import { Service, signal, computed } from '@angular/core';
import type { InventoryRow } from '../../../../../../shared/contracts/business';
import type { RequestItemInput } from '../../../../../../shared/contracts/stock';
import type { DraftLine, ReadyDraftLine } from '../../../../../../shared/contracts/draft';
@Service({ autoProvided: false })
export class DraftStore {
  private readonly value = signal<DraftLine[]>([]);
  readonly lines = this.value.asReadonly();
  readonly clearEpoch = signal(0);
  mergeProposal(lines: DraftLine[], replaceIds: string[] = []): boolean {
    if (replaceIds.some((id) => !this.lines().some((l) => l.lineId === id))) return false;
    const next = this.lines().filter((l) => !replaceIds.includes(l.lineId));
    for (const line of lines) {
      const index =
        line.status === 'READY'
          ? next.findIndex((l) => l.status === 'READY' && l.productId === line.productId)
          : -1;
      const existing = next[index];
      if (existing?.status === 'READY' && line.status === 'READY')
        next[index] = {
          ...line,
          ...existing,
          quantity: existing.quantity + line.quantity,
          hqAvailable: line.hqAvailable,
          salonOnHand: line.salonOnHand,
          hqInventoryVersion: line.hqInventoryVersion,
          salonInventoryVersion: line.salonInventoryVersion,
        };
      else next.push({ ...line });
    }
    if (next.length > 6) return false;
    this.value.set(next);
    return true;
  }
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
  restore(items: RequestItemInput[], inventory: InventoryRow[]) {
    this.value.set(
      items.map((item) => {
        const stock = inventory.find((row) => row.productId === item.productId);
        if (!stock)
          return {
            status: 'NEEDS_CLARIFICATION',
            lineId: crypto.randomUUID(),
            originalWording: item.productId,
            reason:
              'Product inventory unavailable. Refresh and add this product again before submitting.',
            origin: 'manual',
            candidates: [],
            quantity: item.quantity,
          };
        return {
          status: 'READY',
          lineId: crypto.randomUUID(),
          productId: item.productId,
          productName: stock.productName,
          quantity: item.quantity,
          origin: 'manual',
          hqAvailable: stock.hqAvailable,
          salonOnHand: stock.salonOnHand,
          hqInventoryVersion: stock.hqInventoryVersion,
          salonInventoryVersion: stock.salonInventoryVersion,
        };
      }),
    );
  }
  clear() {
    this.value.set([]);
    this.clearEpoch.update((v) => v + 1);
  }
}
