import { DatePipe } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import type { RequestSummary } from '../../../../../../shared/contracts/stock/index';
import { ResponsiveLayout } from '../../../core/responsive-layout';
import type { RequestListContext } from '../../../core/request-navigation';
import { StatusChip } from './status-chip';

@Component({
  selector: 'app-request-list',
  imports: [RouterLink, DatePipe, MatButtonModule, MatTableModule, StatusChip],
  templateUrl: './request-list.html',
  styleUrl: './request-list.scss',
})
export class RequestList {
  readonly layout = inject(ResponsiveLayout);
  readonly context = input<RequestListContext>();
  readonly requests = input.required<RequestSummary[]>();
  readonly columns = ['request', 'quantity', 'status', 'action'];
}
