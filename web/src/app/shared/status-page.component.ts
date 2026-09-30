import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { EmptyStateComponent } from './empty-state.component';
import { SessionService } from '../core/session.service';
@Component({
  selector: 'app-status-page',
  imports: [EmptyStateComponent, MatButtonModule],
  template: `<div class="status-page">
    <app-empty-state
      [title]="title()"
      [message]="message()"
      [icon]="kind === 'hq' ? 'warehouse' : kind === 'not-found' ? 'search_off' : 'lock'"
    >
      @if (kind === 'no-access') {
        <button mat-stroked-button (click)="retry()">Retry access</button
        ><button mat-button (click)="signOut()">Sign out</button>
      } @else {
        <button mat-stroked-button (click)="home()">
          {{ kind === 'hq' ? 'View salon stock' : 'Go to workspace' }}
        </button>
      }
    </app-empty-state>
  </div>`,
  styles: `
    .status-page {
      max-width: 700px;
      margin: 32px auto;
      padding: 16px;
    }
  `,
})
export class StatusPageComponent {
  private readonly route = inject(ActivatedRoute);
  readonly session = inject(SessionService);
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
