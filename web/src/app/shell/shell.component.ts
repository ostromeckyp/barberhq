import { Component, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { ShellFacade } from './shell.facade';
import { Brand } from '../shared/ui/brand/brand';
@Component({
  selector: 'app-shell',
  providers: [ShellFacade],
  imports: [
    Brand,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly drawer = viewChild(MatSidenav);
  readonly facade = inject(ShellFacade);
  readonly mobile = toSignal(inject(BreakpointObserver).observe('(max-width: 759px)'));
  closeDrawer() {
    if (this.mobile()?.matches) void this.drawer()?.close();
  }
}
