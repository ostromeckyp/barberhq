import { Component } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
@Component({
  selector: 'app-low-stock-chip',
  imports: [MatChipsModule, MatIconModule, TranslocoPipe],
  template: `<mat-chip
    ><mat-icon matChipAvatar>warning</mat-icon>{{ 'common.lowStock' | transloco }}</mat-chip
  >`,
  styles: `
    @use '@angular/material' as mat;
    :host {
      display: inline-block;
    }
    mat-chip {
      @include mat.chips-overrides(
        (
          elevated-container-color: var(--warning-background),
          label-text-color: var(--warning-text),
          with-avatar-avatar-size: 16px,
          label-text-size: 12px,
          container-height: 28px,
          container-shape-radius: 8px,
          outline-width: 0px,
        )
      );
    }
    mat-icon {
      color: var(--warning-text);
      font-size: 16px;
    }
  `,
})
export class LowStockChip {}
