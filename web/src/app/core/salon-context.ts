import { Service, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, PRIMARY_OUTLET, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { SessionFacade } from '../features/auth/feature/session.facade';

export type Workspace = { kind: 'HQ' } | { kind: 'SALON'; salonId: string };
export type WorkspaceSelection = 'HQ' | `SALON:${string}`;

@Service()
export class SalonContext {
  private readonly router = inject(Router);
  private readonly session = inject(SessionFacade);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  private readonly segments = computed(
    () =>
      this.router
        .parseUrl(this.url())
        .root.children[PRIMARY_OUTLET]?.segments.map((part) => part.path) ?? [],
  );
  readonly workspace = computed((): Workspace | undefined => {
    const state = this.session.state();
    if (state.status !== 'READY') return undefined;
    const parts = this.segments();
    if (parts[0] === 'hq') return state.membership.role === 'HQ' ? { kind: 'HQ' } : undefined;
    if (parts[0] === 'salons')
      return parts[1] && state.membership.salonIds.includes(parts[1])
        ? { kind: 'SALON', salonId: parts[1] }
        : undefined;
    return state.membership.role === 'HQ' ? { kind: 'HQ' } : undefined;
  });
  readonly salonId = computed(() => {
    const current = this.workspace();
    return current?.kind === 'SALON' ? current.salonId : undefined;
  });
  readonly selectedWorkspace = computed<WorkspaceSelection | undefined>(() => {
    const current = this.workspace();
    return current?.kind === 'HQ' ? 'HQ' : current ? `SALON:${current.salonId}` : undefined;
  });
  readonly home = computed(() => {
    const current = this.workspace();
    if (current?.kind === 'HQ') return this.router.createUrlTree(['/hq']);
    if (current?.kind === 'SALON') return this.router.createUrlTree(['/salons', current.salonId]);
    return this.router.parseUrl(this.session.home());
  });

  switchSalon(salonId: string): Promise<boolean> {
    const state = this.session.state();
    if (state.status !== 'READY' || !state.membership.salonIds.includes(salonId))
      return Promise.resolve(false);
    return this.router.navigate(['/salons', salonId]);
  }

  switchWorkspace(selection: WorkspaceSelection): Promise<boolean> {
    if (selection === 'HQ') {
      const state = this.session.state();
      return state.status === 'READY' && state.membership.role === 'HQ'
        ? this.router.navigateByUrl('/hq')
        : Promise.resolve(false);
    }
    return selection.startsWith('SALON:')
      ? this.switchSalon(selection.slice('SALON:'.length))
      : Promise.resolve(false);
  }
}
