import { PendingTasks, Service, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import type { TranslatedText } from '../../../core/models/translated-text';
import type { SalonShorthand } from '../../../../../../shared/contracts/product-lookup/index';
import { SessionFacade } from '../../auth/feature/session.facade';
import { SalonShorthandApi, ShorthandRemoveError } from '../data-access/salon-shorthand-api';

/** Learned salon phrases; independent of the low-stock threshold form and its version. */
@Service({ autoProvided: false })
export class SalonShorthandFacade {
  private readonly api = inject(SalonShorthandApi);
  private readonly session = inject(SessionFacade);
  private readonly tasks = inject(PendingTasks);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  private readonly scope = computed(() => {
    const s = this.session.state(),
      salonId = this.params()?.get('salonId');
    if (s.status !== 'READY' || !salonId) return undefined;
    const assigned = s.membership.salonIds.includes(salonId);
    return s.membership.role === 'HQ' || assigned
      ? {
          salonId,
          userId: s.membership.userId,
          businessId: s.membership.businessId,
          role: s.membership.role,
          canRemove: s.membership.role === 'SALON' && assigned,
        }
      : undefined;
  });
  private scopeKey = '';
  private generation = 0;
  /** Idempotency key per alias, kept until an authoritative answer so retries replay. */
  private readonly keys = new Map<string, string>();
  readonly rows = signal<SalonShorthand[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal<TranslatedText | null>(null);
  readonly removing = signal<string | null>(null);
  private readonly next = signal<string | null>(null);
  readonly canRemove = computed(() => !!this.scope()?.canRemove);
  readonly hasMore = computed(() => this.next() !== null);
  readonly empty = computed(() => this.loaded() && !this.error() && !this.rows().length);
  constructor() {
    effect(() => {
      const scope = this.scope();
      const key = JSON.stringify(scope ?? null);
      if (key === this.scopeKey) return;
      this.scopeKey = key;
      this.generation++;
      this.keys.clear();
      this.rows.set([]);
      this.next.set(null);
      this.loaded.set(false);
      this.error.set(null);
      this.removing.set(null);
      if (scope) void this.load();
    });
  }
  reload(): void {
    void this.load();
  }
  async loadMore(): Promise<void> {
    const after = this.next();
    if (after !== null && !this.loading()) await this.load(after);
  }
  private async load(after?: string): Promise<void> {
    const scope = this.scope();
    if (!scope) return;
    const generation = ++this.generation;
    const task = this.tasks.add();
    this.loading.set(true);
    this.error.set(null);
    try {
      const page = await this.api.list(scope.salonId, after);
      if (generation !== this.generation) return;
      this.rows.update((rows) => (after ? [...rows, ...page.rows] : page.rows));
      this.next.set(page.nextCursor);
      this.loaded.set(true);
    } catch {
      if (generation === this.generation) this.error.set({ key: 'common.shorthand.loadFailed' });
    } finally {
      if (generation === this.generation) this.loading.set(false);
      task();
    }
  }
  async remove(row: SalonShorthand): Promise<void> {
    const scope = this.scope();
    if (!scope?.canRemove || this.removing()) return;
    const idempotencyKey = this.keys.get(row.id) ?? crypto.randomUUID();
    this.keys.set(row.id, idempotencyKey);
    const generation = this.generation;
    this.removing.set(row.id);
    this.error.set(null);
    try {
      const done = await this.api.remove({
        salonId: scope.salonId,
        aliasId: row.id,
        expectedRevision: row.revision,
        idempotencyKey,
      });
      if (generation !== this.generation) return;
      this.keys.delete(row.id);
      this.rows.update((rows) => rows.filter((r) => r.id !== done.id));
    } catch (error) {
      if (generation !== this.generation) return;
      const code = error instanceof ShorthandRemoveError ? error.code : 'UNKNOWN';
      if (code === 'UNKNOWN') {
        this.error.set({ key: 'salon.shorthand.errors.unknown' });
        return;
      }
      this.keys.delete(row.id);
      if (code === 'STALE_STATE') {
        await this.load();
        this.error.set({ key: 'salon.shorthand.errors.changed' });
      } else
        this.error.set({
          key:
            code === 'FORBIDDEN'
              ? 'salon.shorthand.errors.forbidden'
              : 'salon.shorthand.errors.failed',
        });
    } finally {
      if (this.removing() === row.id) this.removing.set(null);
    }
  }
}
