import { TranslocoPipe } from '@jsverse/transloco';
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import type { CitedStep, ProcedureResult } from '../../../../../shared/contracts/ai/index';
import type { SourceSection } from '../../../../../shared/contracts/knowledge/index';
import { SourceExcerptComponent } from './source-excerpt.component';

@Component({
  selector: 'app-cited-answer',
  imports: [RouterLink, MatIconModule, SourceExcerptComponent, TranslocoPipe],
  template: `
    <section class="answer" [attr.aria-label]="'procedures.answer.label' | transloco">
      @if (hasSyntheticSources()) {
        <div class="synthetic-banner">
          <mat-icon aria-hidden="true">science</mat-icon>
          <span>{{
            (allSourcesSynthetic()
              ? 'procedures.answer.syntheticAll'
              : 'procedures.answer.syntheticSome'
            ) | transloco
          }}</span>
        </div>
      }
      <div class="answer-layout">
        <div class="guidance">
          @if (question()) {
            <div class="asked-question">
              <p class="eyebrow">{{ 'procedures.answer.question' | transloco }}</p>
              <p>{{ question() }}</p>
            </div>
          }
          <h2>{{ 'procedures.answer.whatToDo' | transloco }}</h2>
          <ol role="list">
            @for (step of answer().steps; track $index) {
              <li>
                <span class="step-number" aria-hidden="true">{{ $index + 1 }}</span>
                <div class="step-body">
                  <p>{{ step.text }}</p>
                  <div class="citations">
                    @for (source of sourcesFor(step); track source.sourceSectionId) {
                      <a
                        class="citation"
                        [routerLink]="['/procedures/sources', source.versionId]"
                        [queryParams]="{
                          chunk: source.chunkId,
                          page: source.physicalPage,
                          returnTo: 'assistant',
                        }"
                        [attr.aria-label]="
                          'procedures.answer.openParagraph'
                            | transloco
                              : {
                                  section: source.sectionId,
                                  title: source.title,
                                  version: source.version,
                                  page: source.physicalPage,
                                }
                        "
                      >
                        <mat-icon aria-hidden="true">link</mat-icon>
                        {{
                          'procedures.answer.citation'
                            | transloco
                              : {
                                  number: sourceNumber(source),
                                  section: source.sectionId,
                                  page: source.physicalPage,
                                }
                        }}
                      </a>
                    }
                  </div>
                </div>
              </li>
            }
          </ol>
          @if (answer().missingInformation.length) {
            <section
              class="missing"
              [attr.aria-label]="'procedures.answer.missingLabel' | transloco"
            >
              <h3>{{ 'procedures.answer.missing' | transloco }}</h3>
              <ul>
                @for (item of answer().missingInformation; track $index) {
                  <li>{{ item }}</li>
                }
              </ul>
            </section>
          }
          <footer>
            {{ 'procedures.answer.footer' | transloco }}
          </footer>
        </div>
        <aside class="sources" [attr.aria-label]="'procedures.answer.sourcesLabel' | transloco">
          <h2>
            {{ 'procedures.answer.sources' | transloco }} <span>{{ sources().length }}</span>
          </h2>
          @for (source of sources(); track source.sourceSectionId) {
            <app-source-excerpt
              [source]="source"
              [number]="$index + 1"
              [initiallyExpanded]="$first"
            />
          }
        </aside>
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .answer {
      container: procedure-answer / inline-size;
      margin-top: 20px;
    }
    .synthetic-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      margin-bottom: 20px;
      border-radius: 12px;
      background: var(--ink);
      color: #f6f5f2;
      font-size: 14.5px;
      font-weight: 600;
      line-height: 1.4;
    }
    .synthetic-banner mat-icon {
      color: #ff8a80;
      flex-shrink: 0;
    }
    .answer-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
      gap: 20px;
      align-items: start;
    }
    .guidance {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px;
      min-width: 0;
    }
    h2 {
      margin: 0 0 14px;
      font-size: 18px;
    }
    .asked-question {
      margin-bottom: 16px;
    }
    .asked-question p {
      margin: 4px 0 0;
      line-height: 1.45;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }
    .asked-question .eyebrow {
      font: 600 11px var(--font-mono);
      letter-spacing: 0.06em;
      color: var(--muted);
    }
    ol {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    ol > li {
      display: grid;
      grid-template-columns: 28px minmax(0, 1fr);
      gap: 12px;
      margin-bottom: 18px;
    }
    .step-number {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--ink);
      color: white;
      font: 600 13px var(--font-mono);
    }
    .step-body > p {
      margin: 3px 0 8px;
      line-height: 1.45;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .citations {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .citation {
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-height: 32px;
      padding: 4px 8px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: transparent;
      color: var(--ink);
      font:
        500 12.5px 'Archivo Variable',
        sans-serif;
      cursor: pointer;
      text-align: left;
      overflow-wrap: anywhere;
      max-width: 100%;
    }
    .citation:hover,
    .citation:focus-visible {
      background: #f8d7d5;
    }
    .citation mat-icon {
      flex-shrink: 0;
      font-size: 16px;
      height: 16px;
      width: 16px;
    }
    footer {
      border-top: 1px solid var(--divider);
      padding-top: 12px;
      font-size: 12.5px;
      line-height: 1.45;
      color: var(--muted);
    }
    .sources {
      display: grid;
      gap: 10px;
      min-width: 0;
    }
    .sources h2 {
      font-size: 16px;
      margin: 0;
    }
    .sources h2 span {
      margin-left: 4px;
      font: 600 13px var(--font-mono);
      color: var(--muted);
    }
    .missing {
      margin: 18px 0;
    }
    .missing h3 {
      font-size: 15px;
      margin: 0 0 8px;
    }
    .missing ul {
      margin: 0;
      padding-left: 20px;
      line-height: 1.5;
    }
    @container procedure-answer (max-width: 759px) {
      .answer-layout {
        grid-template-columns: minmax(0, 1fr);
      }
      .citation {
        text-decoration: none;
        min-height: 40px;
      }
    }
  `,
})
export class CitedAnswerComponent {
  readonly answer = input.required<Extract<ProcedureResult, { status: 'ANSWER' }>>();
  readonly question = input('');
  readonly sources = computed(() => [
    ...new Map(this.answer().sources.map((source) => [source.sourceSectionId, source])).values(),
  ]);
  readonly hasSyntheticSources = computed(() => this.sources().some((source) => source.synthetic));
  readonly allSourcesSynthetic = computed(() => this.sources().every((source) => source.synthetic));
  sourcesFor(step: CitedStep): SourceSection[] {
    return this.sources().filter((source) =>
      step.sourceSectionIds.includes(source.sourceSectionId),
    );
  }
  sourceNumber(source: SourceSection): number {
    return this.sources().findIndex((item) => item.sourceSectionId === source.sourceSectionId) + 1;
  }
}
