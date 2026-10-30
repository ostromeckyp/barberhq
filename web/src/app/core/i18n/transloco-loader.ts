import { Injectable } from '@angular/core';
import type { Translation, TranslocoLoader } from '@jsverse/transloco';

/** Loads `public/i18n/<lang>.json`, served at the site root. */
@Injectable({ providedIn: 'root' })
export class FetchTranslocoLoader implements TranslocoLoader {
  async getTranslation(lang: string): Promise<Translation> {
    const response = await fetch(`/i18n/${encodeURIComponent(lang)}.json`);
    if (!response.ok) throw new Error(`Could not load ${lang} translations (${response.status})`);
    return (await response.json()) as Translation;
  }
}
