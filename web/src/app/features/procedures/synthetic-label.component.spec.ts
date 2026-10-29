import { TestBed } from '@angular/core/testing';
import { expect, it } from 'vitest';
import { SyntheticLabelComponent } from './synthetic-label.component';
it('renders kind-specific synthetic and official provenance in shared citation labels', () => {
  const fixture = TestBed.createComponent(SyntheticLabelComponent);
  fixture.componentRef.setInput('source', {
    kind: 'product-card',
    origin: 'synthetic',
    synthetic: true,
  });
  fixture.detectChanges();
  expect(fixture.nativeElement.textContent).toContain('Synthetic demo product card');
  expect(fixture.nativeElement.textContent).not.toContain('procedure');
  fixture.componentRef.setInput('source', { kind: 'policy', origin: 'official', synthetic: false });
  fixture.detectChanges();
  expect(fixture.nativeElement.textContent).toContain('Official policy');
});
