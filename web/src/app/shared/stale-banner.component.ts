import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
@Component({
  selector: 'app-stale-banner',
  imports: [MatIconModule],
  template: `<div role="status">
    <mat-icon>warning</mat-icon><span>{{ message() }}</span
    ><ng-content />
  </div>`,
  styles: `
    div {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: #fbefd6;
      color: #5c3700;
      border-radius: 8px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    span {
      flex: 1;
      min-width: 140px;
    }
  `,
})
export class StaleBannerComponent {
  readonly message = input.required<string>();
}
