import { Component, inject } from '@angular/core';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { Language } from '../../../core/language';
import type { AppLanguage } from '../../../core/models/app-language';

/** Each language is named in its own language, so these labels are never translated. */
const languageOptions: readonly { value: AppLanguage; label: string }[] = [
  { value: 'pl', label: 'Polski' },
  { value: 'en', label: 'English' },
];

@Component({
  selector: 'app-language-select',
  imports: [MatSelectModule, TranslocoPipe],
  template: `<mat-select
    class="language-select"
    [aria-label]="'common.language.label' | transloco"
    [value]="language.current()"
    (selectionChange)="language.set($event.value)"
  >
    @for (option of options; track option.value) {
      <mat-option [value]="option.value" [attr.lang]="option.value">{{ option.label }}</mat-option>
    }
  </mat-select>`,
  styles: `
    :host {
      display: inline-block;
      min-width: 112px;
    }
  `,
})
export class LanguageSelect {
  readonly language = inject(Language);
  readonly options = languageOptions;
}
