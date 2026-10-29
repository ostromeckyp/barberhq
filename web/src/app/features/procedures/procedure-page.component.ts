import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { PageHeader } from '../../shared/ui/page-header/page-header';
import { runtimeConfig } from '../../core/public-config';
import { DocumentLibraryComponent } from './document-library.component';
import { ProcedureAssistantComponent } from './procedure-assistant.component';
import { AssistantFacade } from './assistant.facade';

@Component({
  selector: 'app-procedure-page',
  imports: [
    PageHeader,
    MatTabsModule,
    MatIconModule,
    MatButtonModule,
    DocumentLibraryComponent,
    ProcedureAssistantComponent,
  ],
  template: `
    @if (assistantEnabled) {
      <section class="procedure-page">
        @if (facade.deliveryBack(); as back) {
          <div class="app-back-navigation">
            <button
              mat-stroked-button
              type="button"
              class="app-back-button"
              (click)="backToDelivery()"
            >
              Back to {{ back.label }}
            </button>
          </div>
        }
        <app-page-header
          title="Procedures"
          eyebrow="PROCEDURES"
          description="Ask the assistant or open a document. Guidance only — nothing here changes stock, files claims or grants replacements."
        />
        <mat-tab-group
          [selectedIndex]="selectedIndex()"
          (selectedIndexChange)="selectTab($event)"
          aria-label="Procedures"
          mat-stretch-tabs="false"
        >
          <mat-tab>
            <ng-template mat-tab-label
              ><mat-icon aria-hidden="true">auto_awesome</mat-icon>Assistant</ng-template
            >
            @if (selectedIndex() === 0) {
              <app-procedure-assistant />
            }
          </mat-tab>
          <mat-tab>
            <ng-template mat-tab-label
              ><mat-icon aria-hidden="true">folder_open</mat-icon>Documents</ng-template
            >
            @if (selectedIndex() === 1) {
              <app-document-library [embedded]="true" />
            }
          </mat-tab>
        </mat-tab-group>
      </section>
    } @else {
      <app-document-library />
    }
  `,
  styles: `
    .procedure-page {
      max-width: 1180px;
      min-width: 0;
      margin: 0 auto;
      padding: 0 0 28px;
    }
    mat-tab-group mat-icon {
      margin-right: 6px;
      width: 18px;
      height: 18px;
      font-size: 18px;
    }
  `,
})
export class ProcedurePageComponent {
  readonly facade = inject(AssistantFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly assistantEnabled =
    runtimeConfig.publicConfig?.ragEnabled === true &&
    runtimeConfig.publicConfig?.knowledgeEnabled === true;
  readonly selectedIndex = computed(() => (this.query().get('tab') === 'documents' ? 1 : 0));

  constructor() {
    effect(() => {
      const query = this.query();
      if (
        this.assistantEnabled &&
        query.get('deliveryProblem') &&
        this.facade.suggestDeliveryQuestion(query)
      )
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { deliveryProblem: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
    });
  }

  backToDelivery() {
    const back = this.facade.deliveryBack();
    if (back) void this.router.navigate(back.commands, { queryParams: back.queryParams });
  }

  selectTab(index: number): void {
    if (index === this.selectedIndex()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: index === 1 ? 'documents' : 'assistant' },
      queryParamsHandling: 'merge',
    });
  }
}
