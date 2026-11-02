import { Service, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SessionFacade } from '../../auth/feature/session.facade';

@Service({ autoProvided: false })
export class LoginFacade {
  private readonly session = inject(SessionFacade);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly submitting = signal(false);
  private readonly failure = signal('');
  readonly error = this.failure.asReadonly();
  readonly signInErrorMessage = 'login.errors.signIn';
  readonly checkingAccess = computed(() => this.session.state().status === 'LOADING');
  readonly busy = computed(() => this.submitting() || this.checkingAccess());

  constructor() {
    effect(() => {
      const state = this.session.state();
      if (state.status === 'READY') {
        const requested = this.route.snapshot.queryParamMap.get('returnUrl');
        const roots = this.session
          .salons()
          .flatMap((s) => [`/salons/${s.id}`, `/salons/${encodeURIComponent(s.id)}`]);
        if (state.membership.role === 'HQ') roots.push('/hq');
        const allowed =
          !!requested && roots.some((r) => requested === r || requested.startsWith(`${r}/`));
        void this.router.navigateByUrl(allowed ? requested : this.session.home());
      } else if (state.status === 'NO_ACCESS' || state.status === 'ERROR') {
        void this.router.navigateByUrl('/no-access');
      }
    });
  }

  async signIn(email: string, password: string) {
    if (this.busy()) return;
    this.submitting.set(true);
    this.failure.set('');
    try {
      await this.session.signIn(email.trim(), password);
    } catch {
      this.failure.set(this.signInErrorMessage);
    } finally {
      this.submitting.set(false);
    }
  }
}
