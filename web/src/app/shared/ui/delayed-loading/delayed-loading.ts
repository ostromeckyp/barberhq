import {
  Directive,
  EmbeddedViewRef,
  effect,
  inject,
  input,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';

/** Delays rendering of transient loading UI while leaving the operation itself untouched. */
@Directive({
  selector: '[appDelayedLoading]',
  standalone: true,
})
export class DelayedLoadingDirective {
  readonly appDelayedLoading = input(false);

  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);
  private view?: EmbeddedViewRef<unknown>;

  constructor() {
    effect((onCleanup) => {
      if (!this.appDelayedLoading()) {
        this.clearView();
        return;
      }

      const timer = setTimeout(() => {
        if (this.appDelayedLoading()) {
          this.view ??= this.container.createEmbeddedView(this.template);
        }
      }, 200);

      onCleanup(() => {
        clearTimeout(timer);
        this.clearView();
      });
    });
  }

  private clearView(): void {
    this.container.clear();
    this.view = undefined;
  }
}
