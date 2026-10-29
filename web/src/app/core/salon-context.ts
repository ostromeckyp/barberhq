import { Service, computed, effect, inject, signal, untracked } from '@angular/core';
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
      map((event) => {
        this.rememberFromUrl(this.url());
        const destination =
          this.router
            .parseUrl(event.urlAfterRedirects)
            .root.children[PRIMARY_OUTLET]?.segments.map((part) => part.path) ?? [];
        if (
          destination[0] !== 'hq' &&
          destination[0] !== 'salons' &&
          destination[0] !== 'procedures'
        )
          this.remembered.set(null);
        return event.urlAfterRedirects;
      }),
    ),
    { initialValue: this.router.url },
  );
  private readonly segments = computed(
    () =>
      this.router
        .parseUrl(this.url())
        .root.children[PRIMARY_OUTLET]?.segments.map((part) => part.path) ?? [],
  );
  private readonly remembered = signal<{
    userId: string;
    businessId: string;
    workspace: Workspace;
  } | null>(null);
  constructor() {
    effect(() => {
      const state = this.session.state();
      if (state.status !== 'READY') {
        this.remembered.set(null);
        return;
      }
      const remembered = untracked(this.remembered);
      const membership = state.membership;
      if (
        remembered &&
        (remembered.userId !== membership.userId ||
          remembered.businessId !== membership.businessId ||
          !this.authorized(remembered.workspace, membership))
      )
        this.remembered.set(null);
    });
  }
  private rememberFromUrl(url: string): void {
    const state = this.session.state();
    if (state.status !== 'READY') return;
    const parts =
      this.router.parseUrl(url).root.children[PRIMARY_OUTLET]?.segments.map((part) => part.path) ??
      [];
    const workspace: Workspace | null =
      parts[0] === 'hq' && state.membership.role === 'HQ'
        ? { kind: 'HQ' }
        : parts[0] === 'salons' && parts[1] && state.membership.salonIds.includes(parts[1])
          ? { kind: 'SALON', salonId: parts[1] }
          : null;
    if (workspace)
      this.remembered.set({
        userId: state.membership.userId,
        businessId: state.membership.businessId,
        workspace,
      });
  }
  private authorized(
    workspace: Workspace,
    membership: { role: string; salonIds: string[] },
  ): boolean {
    return workspace.kind === 'HQ'
      ? membership.role === 'HQ'
      : membership.salonIds.includes(workspace.salonId);
  }
  readonly workspace = computed((): Workspace | undefined => {
    const state = this.session.state();
    if (state.status !== 'READY') return undefined;
    const parts = this.segments();
    if (parts[0] === 'hq') return state.membership.role === 'HQ' ? { kind: 'HQ' } : undefined;
    if (parts[0] === 'salons')
      return parts[1] && state.membership.salonIds.includes(parts[1])
        ? { kind: 'SALON', salonId: parts[1] }
        : undefined;
    if (parts[0] === 'procedures') {
      const remembered = this.remembered();
      if (
        remembered?.userId === state.membership.userId &&
        remembered.businessId === state.membership.businessId &&
        this.authorized(remembered.workspace, state.membership)
      )
        return remembered.workspace;
      if (state.membership.role === 'HQ') return { kind: 'HQ' };
      const salonId = state.membership.salonIds[0];
      return salonId ? { kind: 'SALON', salonId } : undefined;
    }
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
