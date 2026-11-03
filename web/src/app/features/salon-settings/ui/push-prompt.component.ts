import { Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PushFacade } from '../feature/push.facade';

const dismissedKey = 'barberhq.push.promptDismissed';

const readDismissed = (): boolean => {
  try {
    return localStorage.getItem(dismissedKey) === '1';
  } catch {
    return false;
  }
};

/** One-time dashboard offer to turn on notifications; "Not now" hides it on this device. */
@Component({
  selector: 'app-push-prompt',
  imports: [MatButtonModule, MatIconModule, TranslocoPipe],
  template: `
    @if (visible()) {
      <aside class="push-prompt" aria-labelledby="push-prompt-text">
        <mat-icon aria-hidden="true">notifications</mat-icon>
        @if (facade.status() === 'install-required') {
          <p id="push-prompt-text">{{ 'salon.push.install' | transloco }}</p>
        } @else {
          <p id="push-prompt-text">{{ 'salon.push.prompt.text' | transloco }}</p>
          <button mat-flat-button [disabled]="facade.busy()" (click)="facade.enable()">
            {{ 'salon.push.enable' | transloco }}
          </button>
        }
        <button mat-button (click)="dismiss()">{{ 'salon.push.prompt.later' | transloco }}</button>
      </aside>
    }
  `,
  styles: `
    .push-prompt {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      margin: 0 0 16px;
      padding: 12px 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      background: var(--surface);
    }
    p {
      flex: 1 1 220px;
      margin: 0;
    }
  `,
})
export class PushPromptComponent {
  readonly facade = inject(PushFacade);
  private readonly dismissed = signal(readDismissed());
  readonly visible = computed(
    () =>
      !this.dismissed() &&
      this.facade.available() &&
      (this.facade.status() === 'default' || this.facade.status() === 'install-required'),
  );

  dismiss(): void {
    this.dismissed.set(true);
    try {
      localStorage.setItem(dismissedKey, '1');
    } catch {
      /* Storage blocked: hidden for this visit only. */
    }
  }
}
