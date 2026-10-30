import { formatDate } from '@angular/common';
import { inject, Pipe, PipeTransform } from '@angular/core';
import { Language } from '../../core/language';

/** `DatePipe` in the current UI language; impure so a language switch re-renders. */
@Pipe({ name: 'appDate', pure: false })
export class AppDatePipe implements PipeTransform {
  private readonly language = inject(Language);

  transform(value: string | Date | null | undefined, format: string, timezone?: string): string {
    if (value === null || value === undefined || value === '') return '';
    return formatDate(value, format, this.language.locale(), timezone);
  }
}
