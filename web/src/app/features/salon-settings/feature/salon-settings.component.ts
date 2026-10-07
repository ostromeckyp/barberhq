import { Component, inject } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { SalonSettingsFacade } from './salon-settings.facade';
@Component({
  selector: 'app-salon-settings',
  providers: [SalonSettingsFacade],
  imports: [
    FormField,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatProgressBarModule,
    PageHeader,
  ],
  templateUrl: './salon-settings.component.html',
  styleUrl: './salon-settings.component.scss',
})
export class SalonSettingsComponent {
  readonly facade = inject(SalonSettingsFacade);
}
