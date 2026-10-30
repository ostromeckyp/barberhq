import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'app-back-link',
  imports: [MatButtonModule, MatIconModule, RouterLink],
  template: `
    @if (link(); as target) {
      <a mat-button [routerLink]="target"
        ><mat-icon aria-hidden="true">arrow_back</mat-icon>{{ label() }}</a
      >
    } @else {
      <button mat-button type="button" (click)="back.emit()">
        <mat-icon aria-hidden="true">arrow_back</mat-icon>{{ label() }}
      </button>
    }
  `,
  styles: `
    :host {
      display: block;
      text-align: left;
      margin-bottom: 8px;
    }
  `,
})
export class BackLink {
  /** Router commands. Omit when the destination is computed and handled by `back`. */
  readonly link = input<string | readonly unknown[]>();
  readonly label = input.required<string>();
  readonly back = output<void>();
}
