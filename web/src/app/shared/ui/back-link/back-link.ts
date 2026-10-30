import { Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'app-back-link',
  imports: [MatButtonModule, MatIconModule, RouterLink],
  template: `<a mat-button [routerLink]="link()"
    ><mat-icon aria-hidden="true">arrow_back</mat-icon>{{ label() }}</a
  >`,
  styles: `
    :host {
      display: block;
      text-align: left;
      margin-bottom: 8px;
    }
  `,
})
export class BackLink {
  readonly link = input.required<string | readonly unknown[]>();
  readonly label = input.required<string>();
}
