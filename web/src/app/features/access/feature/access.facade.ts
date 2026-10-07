import { Service, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SessionFacade } from '../../auth/feature/session.facade';

@Service({ autoProvided: false })
export class AccessFacade {
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(SessionFacade);
  private readonly router = inject(Router);
  readonly kind = this.route.snapshot.data['kind'] as string;
  title() {
    return this.kind === 'hq'
      ? 'HQ workspace'
      : this.kind === 'not-found'
        ? 'Page not found'
        : this.session.state().status === 'ERROR'
          ? 'Could not verify access'
          : 'No workspace access';
  }
  message() {
    return this.kind === 'hq'
      ? 'Salon inventory is ready. The replenishment queue will become available in the next increment.'
      : this.kind === 'not-found'
        ? 'This address does not point to a page in your workspace.'
        : 'Your HQ team manages salon permissions. If you were just assigned access, try again.';
  }
  async retry() {
    await this.session.retry();
    if (this.session.state().status === 'READY')
      await this.router.navigateByUrl(this.session.home());
  }
  async signOut() {
    try {
      await this.session.signOut();
      await this.router.navigateByUrl('/login');
    } catch {
      /* Keep access screen visible; retry remains available. */
    }
  }
  home() {
    const id = this.session.salons()[0]?.id;
    void this.router.navigateByUrl(
      this.kind === 'hq' && id ? `/salons/${encodeURIComponent(id)}` : this.session.home(),
    );
  }
}
