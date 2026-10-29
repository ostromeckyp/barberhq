import { Component, input, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import type { SourceSection } from '../../../../../shared/contracts/knowledge/index';
import { SyntheticLabelComponent } from './synthetic-label.component';

@Component({
  selector: 'app-source-excerpt',
  imports: [
    RouterLink,
    MatButtonModule,
    MatExpansionModule,
    MatIconModule,
    SyntheticLabelComponent,
  ],
  template: `
    <mat-expansion-panel
      class="source"
      [expanded]="expanded()"
      (opened)="expanded.set(true)"
      (closed)="expanded.set(false)"
    >
      <mat-expansion-panel-header
        [attr.aria-label]="
          'Source ' +
          number() +
          ': ' +
          source().title +
          ', ' +
          source().sectionId +
          ', page ' +
          source().physicalPage
        "
      >
        <mat-panel-title>
          <span class="source-number">{{ number() }}</span>
          <span class="metadata"
            ><strong>{{ source().title }}</strong
            ><span>Version {{ source().version }} · Page {{ source().physicalPage }}</span
            ><span>{{ source().sectionId }}</span></span
          >
        </mat-panel-title>
      </mat-expansion-panel-header>
      <div class="source-body">
        <div class="labels">
          <span class="version">{{ source().version }}</span
          ><app-synthetic-label [source]="source()" />
        </div>
        @if (source().superseded) {
          <p class="history">Historical version · A newer version may be available.</p>
        }
        <blockquote>{{ source().excerpt }}</blockquote>
        <p>Excerpt · {{ source().sectionId }} · Page {{ source().physicalPage }}</p>
        <a
          mat-stroked-button
          [routerLink]="['/procedures/sources', source().versionId]"
          [queryParams]="{
            chunk: source().chunkId,
            page: source().physicalPage,
            returnTo: 'assistant',
          }"
          [attr.aria-label]="
            'Open PDF for ' +
            source().title +
            ', version ' +
            source().version +
            ', page ' +
            source().physicalPage
          "
        >
          <mat-icon aria-hidden="true">picture_as_pdf</mat-icon>Open PDF at page
          {{ source().physicalPage }}
        </a>
      </div>
    </mat-expansion-panel>
  `,
  styles: `
    @use '@angular/material' as mat;
    :host {
      display: block;
      min-width: 0;
    }
    .source {
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface);
      box-shadow: none;
    }
    .source.mat-expanded {
      border-color: var(--ink);
    }
    .source mat-expansion-panel-header,
    .source mat-expansion-panel-header.mat-expanded {
      height: auto;
      min-height: 72px;
      padding: 12px 14px;
      box-sizing: border-box;
    }
    mat-panel-title {
      gap: 12px;
      align-items: flex-start;
      min-width: 0;
      margin-right: 8px;
    }
    .source-number {
      display: grid;
      place-items: center;
      border: 1px solid var(--ink);
      border-radius: 6px;
      min-width: 26px;
      height: 26px;
      font: 600 12px var(--font-mono);
    }
    .metadata {
      display: grid;
      gap: 3px;
      min-width: 0;
    }
    .metadata strong {
      font-size: 14.5px;
      line-height: 1.35;
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .metadata > span {
      font-size: 12.5px;
      line-height: 1.4;
      color: var(--muted);
      overflow-wrap: anywhere;
    }
    .source-body {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .labels {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
    }
    .version {
      padding: 5px 10px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 12.5px;
    }
    p {
      margin: 0;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.4;
      overflow-wrap: anywhere;
    }
    blockquote {
      margin: 0;
      padding: 12px;
      border: 1px solid var(--divider);
      border-radius: 8px;
      background: #faf9f7;
      color: #3b3833;
      font: 13px/1.55 var(--font-mono);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    a {
      @include mat.button-overrides(
        (
          outlined-label-text-color: var(--ink),
        )
      );
      align-self: flex-start;
      height: auto;
      min-height: 40px;
      padding: 8px 14px;
    }
  `,
})
export class SourceExcerptComponent {
  readonly source = input.required<SourceSection>();
  readonly number = input(1);
  readonly initiallyExpanded = input(false);
  readonly expanded = linkedSignal(() => this.initiallyExpanded());
}
