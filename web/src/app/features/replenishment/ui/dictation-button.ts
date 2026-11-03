import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DictationFacade } from '../feature/dictation.facade';

@Component({
  imports: [MatButtonModule, MatIconModule, TranslocoPipe],
  selector: 'app-dictation-button',
  styles: `
    :host {
      display: block;
      margin: 0 0 12px;
    }
    button:not(:disabled) {
      color: var(--ink);
    }
    .error {
      color: var(--error, #8c1d18);
      font-size: 13px;
      margin: 8px 0 0;
    }
    .time {
      font-variant-numeric: tabular-nums;
    }
  `,
  template: `
    @if (dictation.visible()) {
      @let state = dictation.state();
      <button
        mat-stroked-button
        type="button"
        [disabled]="state === 'recognising' || state === 'starting' || dictation.disabled()"
        [attr.aria-pressed]="state === 'recording'"
        (click)="dictation.toggle()"
      >
        <mat-icon aria-hidden="true">{{ state === 'recording' ? 'stop' : 'mic' }}</mat-icon>
        @switch (state) {
          @case ('recording') {
            {{ 'replenishment.dictation.stop' | transloco }}
            <span class="time">{{ clock() }}</span>
          }
          @case ('recognising') {
            {{ 'replenishment.dictation.recognising' | transloco }}
          }
          @default {
            {{ 'replenishment.dictation.start' | transloco }}
          }
        }
      </button>
      @if (dictation.canRetry()) {
        <button mat-button type="button" (click)="dictation.retry()">
          {{ 'replenishment.dictation.retry' | transloco }}
        </button>
      }
      @if (dictation.errorKey(); as key) {
        <p class="error" role="alert">{{ key | transloco }}</p>
      }
    }
  `,
})
export class DictationButton {
  readonly dictation = inject(DictationFacade);
  clock(): string {
    const seconds = Math.floor(this.dictation.elapsedMs() / 1000);
    return `0:${String(seconds).padStart(2, '0')}`;
  }
}
