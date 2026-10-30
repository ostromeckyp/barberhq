import { Component, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type { RequestSummary } from '../../../../../../shared/contracts/stock/index';
import { pluralKey } from '../../../core/i18n/plural';
import { Language } from '../../../core/language';
import { AppDatePipe } from '../../../shared/ui/app-date.pipe';
import { ResponsiveLayout } from '../../../core/responsive-layout';
import type { RequestListContext } from '../../../core/request-navigation';
import { StatusChip } from './status-chip';

@Component({
  selector: 'app-request-list',
  imports: [RouterLink, AppDatePipe, TranslocoPipe, MatButtonModule, MatTableModule, StatusChip],
  templateUrl: './request-list.html',
  styleUrl: './request-list.scss',
})
export class RequestList {
  readonly layout = inject(ResponsiveLayout);
  private readonly language = inject(Language);
  readonly context = input<RequestListContext>();
  readonly requests = input.required<RequestSummary[]>();
  readonly columns = ['request', 'quantity', 'status', 'action'];
  itemsKey(count: number): string {
    return pluralKey('requests.count.items', count, this.language.current());
  }
}
