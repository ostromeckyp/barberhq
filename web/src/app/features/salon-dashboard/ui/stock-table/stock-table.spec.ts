import { TestBed } from '@angular/core/testing';
import { expect, it } from 'vitest';
import { StockTable } from './stock-table';

it('titles the card "Products in stock"', () => {
  TestBed.configureTestingModule({ imports: [StockTable] });
  const fixture = TestBed.createComponent(StockTable);
  fixture.componentRef.setInput('rows', []);
  fixture.componentRef.setInput('threshold', undefined);
  fixture.componentRef.setInput('updated', '');
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('h2').textContent).toContain('Products in stock');
});
