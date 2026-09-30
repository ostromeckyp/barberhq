import { Component, inject, signal, effect } from '@angular/core';
import { form, FormField, required, email } from '@angular/forms/signals';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { SessionService } from '../../core/session.service';
@Component({
  selector: 'app-login',
  imports: [
    FormField,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  template: `
    <main class="login-page">
      <div class="login-brand"><span class="brand-mark">NBS</span><strong>BarberHQ</strong></div>
      <mat-card class="login-card"
        ><mat-card-content
          ><p class="eyebrow">NOT BAD STUFF · OPERATIONS</p>
          <h1>Good to see you.</h1>
          <p class="muted">Sign in to keep your salon stocked.</p>
          <form (submit)="signIn($event)">
            <mat-form-field appearance="outline"
              ><mat-label>Email address</mat-label
              ><input matInput type="email" autocomplete="username" [formField]="fields.email" />
              @if (fields.email().invalid() && fields.email().touched()) {
                <mat-error>Enter a valid email address.</mat-error>
              }
            </mat-form-field>
            <mat-form-field appearance="outline"
              ><mat-label>Password</mat-label
              ><input
                matInput
                [type]="showPassword() ? 'text' : 'password'"
                autocomplete="current-password"
                [formField]="fields.password"
              /><button
                mat-icon-button
                matSuffix
                type="button"
                (click)="showPassword.set(!showPassword())"
                [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
              >
                <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon></button
              ><mat-error>Password is required.</mat-error></mat-form-field
            >
            @if (error()) {
              <p class="error-message" role="alert"><mat-icon>error</mat-icon>{{ error() }}</p>
            }
            <button mat-flat-button type="submit" [disabled]="busy()">
              {{ busy() ? 'Signing in…' : 'Sign in' }}<mat-icon>arrow_forward</mat-icon>
            </button>
            @if (busy()) {
              <mat-progress-bar mode="indeterminate" aria-label="Signing in" />
            }
          </form>
          <p class="login-help">Access is managed by your HQ team.</p></mat-card-content
        ></mat-card
      >
      <p class="demo-note">Demo workspace · Synthetic inventory</p>
    </main>
  `,
  styles: `
    .login-page {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      box-sizing: border-box;
    }
    .login-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 22px;
      margin-bottom: 36px;
    }
    .login-card {
      background: white;
      width: 100%;
      max-width: 420px;
      border: 1px solid var(--border);
    }
    mat-card-content {
      padding: 28px !important;
    }
    h1 {
      font-size: 28px;
      margin: 12px 0;
    }
    .muted {
      margin-bottom: 28px;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    mat-form-field {
      width: 100%;
    }
    .login-help {
      font-size: 13px;
      text-align: center;
      color: var(--muted);
      margin: 24px 0 0;
    }
    .demo-note {
      font-size: 12px;
      margin-top: 24px;
      color: var(--muted);
    }
    @media (max-width: 400px) {
      mat-card-content {
        padding: 20px !important;
      }
    }
  `,
})
export class LoginComponent {
  readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly model = signal({ email: '', password: '' });
  readonly fields = form(this.model, (p) => {
    required(p.email);
    email(p.email);
    required(p.password);
  });
  readonly busy = signal(false);
  readonly error = signal('');
  readonly showPassword = signal(false);
  constructor() {
    effect(() => {
      const state = this.session.state();
      if (state.status === 'READY') {
        const requested = this.route.snapshot.queryParamMap.get('returnUrl');
        const allowed = this.session
          .salons()
          .flatMap((s) => [`/salons/${s.id}`, `/salons/${encodeURIComponent(s.id)}`]);
        if (state.membership.role === 'HQ') allowed.push('/hq');
        void this.router.navigateByUrl(
          requested && allowed.includes(requested) ? requested : this.session.home(),
        );
      } else if (state.status === 'NO_ACCESS' || state.status === 'ERROR')
        void this.router.navigateByUrl('/no-access');
    });
  }
  async signIn(event: Event) {
    event.preventDefault();
    this.fields().markAsTouched();
    if (this.fields().invalid() || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.session.signIn(this.model().email.trim(), this.model().password);
    } catch {
      this.error.set('Could not sign in. Check your email and password, then try again.');
    } finally {
      this.model.update((m) => ({ ...m, password: '' }));
      this.busy.set(false);
    }
  }
}
