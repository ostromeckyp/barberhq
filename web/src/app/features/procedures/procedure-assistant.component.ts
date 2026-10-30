import { TranslocoPipe } from '@jsverse/transloco';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { DelayedLoadingDirective } from '../../shared/ui/delayed-loading/delayed-loading';
import { AssistantFacade } from './assistant.facade';
import { CitedAnswerComponent } from './cited-answer.component';

@Component({
  selector: 'app-procedure-assistant',
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    DelayedLoadingDirective,
    CitedAnswerComponent,
    TranslocoPipe,
  ],
  template: `
    <section class="assistant" [attr.aria-label]="'procedures.assistant.label' | transloco">
      @let example = 'procedures.assistant.examples.damaged' | transloco;
      <form (ngSubmit)="facade.submit()">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'procedures.assistant.question' | transloco }}</mat-label>
          <textarea
            matInput
            rows="2"
            name="question"
            maxlength="1000"
            [ngModel]="facade.question()"
            (ngModelChange)="facade.question.set($event)"
            [placeholder]="'procedures.assistant.placeholder' | transloco"
          ></textarea>
        </mat-form-field>
        <div class="actions">
          <button
            mat-stroked-button
            type="button"
            class="example"
            [disabled]="facade.loading()"
            (click)="facade.question.set(example)"
          >
            <mat-icon aria-hidden="true">format_quote</mat-icon>{{ example }}
          </button>
          <span class="spacer"></span>
          <button mat-button type="button" [disabled]="facade.loading()" (click)="facade.reset()">
            {{ 'procedures.assistant.clear' | transloco }}
          </button>
          <button mat-flat-button type="submit" [disabled]="!facade.canSubmit()">
            <mat-icon aria-hidden="true">search</mat-icon
            >{{ 'procedures.assistant.ask' | transloco }}
          </button>
        </div>
      </form>
      @if (!facade.result() && !facade.loading() && !facade.error()) {
        <p class="initial">
          <mat-icon aria-hidden="true">info</mat-icon
          ><span>{{ 'procedures.assistant.intro' | transloco }}</span>
        </p>
      }
      <p *appDelayedLoading="facade.loading()" role="status" class="state">
        {{ 'procedures.assistant.searching' | transloco }}
      </p>
      @if (facade.error(); as error) {
        <div role="alert" class="error">
          <p>{{ error.key | transloco: error.params }}</p>
          <button mat-stroked-button type="button" (click)="facade.submit()">
            {{ 'procedures.assistant.tryAgain' | transloco }}
          </button>
        </div>
      }
      @if (facade.result(); as result) {
        <div aria-live="polite">
          @switch (result.status) {
            @case ('ANSWER') {
              <app-cited-answer [answer]="result" [question]="facade.submittedQuestion()" />
            }
            @case ('NEEDS_CLARIFICATION') {
              <section class="state">
                <h2>{{ 'procedures.assistant.clarification.title' | transloco }}</h2>
                <p>{{ result.question }}</p>
              </section>
            }
            @case ('INSUFFICIENT_EVIDENCE') {
              <section class="state">
                <h2>{{ 'procedures.assistant.noAnswer.title' | transloco }}</h2>
                <p>{{ result.message }}</p>
              </section>
            }
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      @use '@angular/material' as mat;
      .assistant {
        min-width: 0;
        margin: 0 auto;
        padding: 20px 0 0;
      }
      form {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 16px 18px;
      }
      .spacer {
        flex: 1;
      }
      .initial {
        display: flex;
        gap: 10px;
        margin: 20px 4px;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.5;
      }
      .initial mat-icon {
        flex-shrink: 0;
        font-size: 20px;
      }
      mat-form-field {
        width: 100%;
      }
      textarea {
        resize: vertical;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }
      .actions {
        @include mat.button-overrides(
          (
            text-label-text-color: var(--ink),
          )
        );
      }
      .example {
        @include mat.button-overrides(
          (
            outlined-label-text-color: var(--muted),
          )
        );
        color: var(--muted);
        font-size: 13px;
        margin: 0;
        height: auto;
        min-height: 32px;
        padding: 8px 12px;
        text-align: left;
        white-space: normal;
        border-radius: 8px;
        line-height: 1.4;
      }
      @media (max-width: 759px) {
        .example {
          flex-basis: 100%;
        }
        .spacer {
          display: none;
        }
        .actions > button[type='submit'] {
          margin-left: auto;
        }
      }
      .state,
      .error {
        margin-top: 24px;
        padding: 18px;
        border: 1px solid var(--border);
        border-radius: 10px;
        background: var(--surface);
      }
      .state h2 {
        font-size: 18px;
        margin: 0 0 8px;
      }
      .state p,
      .error p {
        margin: 0 0 10px;
        line-height: 1.5;
        white-space: pre-wrap;
      }
      .error {
        color: var(--warning-text);
        background: var(--warning-background);
      }
    `,
  ],
})
export class ProcedureAssistantComponent {
  readonly facade = inject(AssistantFacade);
}
