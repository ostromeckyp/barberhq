import { Service, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, PRIMARY_OUTLET, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { SessionFacade } from '../features/auth/feature/session.facade';
@Service()
export class SalonContext {
  private readonly router = inject(Router);
  private readonly session = inject(SessionFacade);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  private readonly segments = computed(
    () =>
      this.router.parseUrl(this.url()).root.children[PRIMARY_OUTLET]?.segments.map((s) => s.path) ??
      [],
  );
  private readonly identity = computed(() => {
    const s = this.session.state();
    return s.status === 'READY' ? JSON.stringify(s.membership) : undefined;
  });
  private readonly detail = signal<
    { requestId: string; salonId: string; identity: string } | undefined
  >(undefined);
  readonly salonId = computed(() => {
    const s = this.session.state(),
      parts = this.segments();
    if (s.status !== 'READY') return undefined;
    const d = this.detail();
    const id =
      parts[0] === 'salons'
        ? parts[1]
        : parts[0] === 'requests' && d?.requestId === parts[1] && d.identity === this.identity()
          ? d.salonId
          : undefined;
    return id && s.membership.salonIds.includes(id) ? id : undefined;
  });
  setDetailSalon(requestId: string, salonId: string) {
    const parts = this.segments(),
      identity = this.identity(),
      s = this.session.state();
    if (
      identity &&
      parts[0] === 'requests' &&
      parts[1] === requestId &&
      s.status === 'READY' &&
      s.membership.salonIds.includes(salonId)
    )
      this.detail.set({ requestId, salonId, identity });
  }
  switchSalon(salonId: string): Promise<boolean> {
    const s = this.session.state();
    if (s.status !== 'READY' || !s.membership.salonIds.includes(salonId))
      return Promise.resolve(false);
    const p = this.segments(),
      activity = p[0] === 'requests' ? 'requests' : p[0] === 'salons' ? p[2] : undefined;
    return this.router.navigate([
      '/salons',
      salonId,
      ...(activity === 'requests' || activity === 'settings' ? [activity] : []),
    ]);
  }
}
