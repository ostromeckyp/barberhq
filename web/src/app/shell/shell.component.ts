import { Component, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { ShellFacade } from './shell.facade';
import { TranslocoPipe } from '@jsverse/transloco';
import { Brand } from '../shared/ui/brand/brand';
import { LanguageSelect } from '../shared/ui/language-select/language-select';
import { runtimeConfig } from '../core/public-config';
@Component({
  selector: 'app-shell',
  providers: [ShellFacade],
  imports: [
    Brand,
    LanguageSelect,
    TranslocoPipe,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSelectModule,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly drawer = viewChild(MatSidenav);
  readonly facade = inject(ShellFacade);
  readonly mobile = toSignal(inject(BreakpointObserver).observe('(max-width: 759px)'));
  readonly knowledgeEnabled = () => runtimeConfig.publicConfig?.knowledgeEnabled === true;
  readonly assistantEnabled = () =>
    runtimeConfig.publicConfig?.knowledgeEnabled === true &&
    runtimeConfig.publicConfig?.ragEnabled === true;
  /** Keeps the account menu from treating keys meant for the language select as menu navigation. */
  keepMenuOpen(event: KeyboardEvent) {
    if (event.key !== 'Escape' && event.key !== 'Tab') event.stopPropagation();
  }
  closeDrawer() {
    if (this.mobile()?.matches) void this.drawer()?.close();
  }
}
