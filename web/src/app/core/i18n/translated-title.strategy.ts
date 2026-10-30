import { DOCUMENT, Service, effect, inject, signal } from '@angular/core';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { Language } from '../language';

/** Route titles are translation keys; the document title follows the UI language. */
@Service()
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly document = inject(DOCUMENT);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(Language);
  private readonly key = signal<string | undefined>(undefined);

  constructor() {
    super();
    effect((onCleanup) => {
      const key = this.key();
      const lang = this.language.current();
      if (!key) return;
      const subscription = this.transloco.selectTranslate(key, {}, lang).subscribe((title) => {
        this.document.title = title;
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.key.set(this.buildTitle(snapshot));
  }
}
