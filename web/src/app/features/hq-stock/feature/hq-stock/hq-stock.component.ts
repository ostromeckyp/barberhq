import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { HqStockFacade } from '../hq-stock.facade';

@Component({
  imports: [MatButtonModule, MatTableModule, MatProgressBarModule, PageHeader],
  providers: [HqStockFacade],
  selector: 'app-hq-stock',
  templateUrl: './hq-stock.component.html',
  styleUrl: './hq-stock.component.scss',
})
export class HqStockComponent {
  readonly facade = inject(HqStockFacade);
  readonly columns = ['product', 'onHand', 'reserved', 'available'];
}
