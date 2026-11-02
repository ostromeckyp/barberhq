import { DelayedLoadingDirective } from '../../../shared/ui/delayed-loading/delayed-loading';
import { Component, inject } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { SalonSettingsFacade } from './salon-settings.facade';
import { SalonShorthandFacade } from './salon-shorthand.facade';
import { PushSettingsComponent } from '../ui/push-settings.component';
import { SalonShorthandComponent } from '../ui/salon-shorthand.component';
@Component({
  selector: 'app-salon-settings',
  providers: [SalonSettingsFacade, SalonShorthandFacade],
  imports: [
    FormField,
    TranslocoPipe,
    DelayedLoadingDirective,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatProgressBarModule,
    PageHeader,
    SalonShorthandComponent,
    PushSettingsComponent,
  ],
  templateUrl: './salon-settings.component.html',
  styleUrl: './salon-settings.component.scss',
})
export class SalonSettingsComponent {
  readonly facade = inject(SalonSettingsFacade);
}
