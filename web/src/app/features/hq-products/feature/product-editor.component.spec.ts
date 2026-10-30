import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { expect, it, vi } from 'vitest';
import { ProductAdminApi, ProductAdminError } from '../data-access/product-admin-api';
import { ProductEditorComponent } from './product-editor.component';

const detail = {
  id: 'b:p',
  demoId: 'p',
  form: {
    name: 'Pomada Cement',
    brand: 'NBS',
    category: 'Pomady',
    type: 'pomada',
    summary: 'Volume.',
    scent: null,
    netContentMl: 100,
    retailPriceGrosz: 6900,
    sourceCode: '1',
    sourceUrl: 'https://example.com',
    observedOn: '2026-09-22',
  },
  hq: { onHand: 18, reserved: 2, available: 16, version: 3 },
  revision: 7,
  catalogRevision: 7,
};
async function render(productId?: string, read = vi.fn().mockResolvedValue(detail)) {
  const api = {
    read,
    listAliases: vi.fn().mockResolvedValue({
      aliases: [
        { id: 'a', phrase: 'beton', kind: 'NAME', source: 'HQ', editable: true, revision: 1 },
        {
          id: 'b',
          phrase: 'z katalogu',
          kind: 'NAME',
          source: 'DOCUMENT',
          editable: false,
          revision: 1,
        },
      ],
      collisions: [],
    }),
    cardState: vi.fn().mockRejectedValue(new ProductAdminError('NOT_FOUND')),
    saveAliases: vi.fn().mockResolvedValue({ aliases: [], collisions: [] }),
    create: vi.fn().mockResolvedValue({ ...detail, id: 'b:new' }),
    attachCard: vi.fn().mockResolvedValue({
      productId: 'b:new',
      versionId: 'v1',
      status: 'UPLOADING',
      suggestions: [],
      revision: 1,
    }),
  };
  TestBed.configureTestingModule({
    imports: [ProductEditorComponent],
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      { provide: ProductAdminApi, useValue: api },
    ],
  });
  const fixture = TestBed.createComponent(ProductEditorComponent);
  if (productId) fixture.componentRef.setInput('productId', productId);
  fixture.detectChanges();
  await TestBed.inject(ApplicationRef).whenStable();
  await new Promise((r) => setTimeout(r));
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, api, fixture };
}
it('shows the add form without stock, alias or card sections for a new product', async () => {
  const { el, api } = await render();
  expect(el.textContent).toContain('Add product');
  expect(el.querySelector('[aria-labelledby="product-aliases"]')).toBeNull();
  expect(api.read).not.toHaveBeenCalled();
});
it('shows HQ quantity and aliases with sources; document aliases are read-only', async () => {
  const { el } = await render('b:p');
  expect(el.textContent).toContain('Reserved for salon deliveries: 2 · Available: 16');
  expect(el.textContent).toContain('Manual');
  expect(el.textContent).toContain('From document');
  expect(el.querySelector('button[aria-label="Remove alias beton"]')).not.toBeNull();
  expect(el.querySelector('button[aria-label="Remove alias z katalogu"]')).toBeNull();
});
it('groups aliases by kind and edits one in place', async () => {
  const { el, api, fixture } = await render('b:p');
  expect([...el.querySelectorAll('h3.kind')].map((h) => h.textContent?.trim())).toEqual(['Name']);
  (el.querySelector('button[aria-label="Edit alias beton"]') as HTMLButtonElement).click();
  fixture.detectChanges();
  const input = el.querySelector('input[aria-label="Edit phrase beton"]') as HTMLInputElement;
  expect(input.value).toBe('beton');
  input.value = 'betonik';
  input.dispatchEvent(new Event('input'));
  (el.querySelector('button[aria-label="Save alias beton"]') as HTMLButtonElement).click();
  await new Promise((r) => setTimeout(r));
  expect(api.saveAliases).toHaveBeenCalledWith(
    expect.objectContaining({
      changes: [{ op: 'edit', aliasId: 'a', expectedRevision: 1, phrase: 'betonik', kind: 'NAME' }],
    }),
  );
});

it('puts each section on a card', async () => {
  const { el } = await render('b:p');
  for (const id of ['product-details', 'hq-quantity', 'product-aliases', 'product-card'])
    expect(el.querySelector(`section.card[aria-labelledby="${id}"]`)).not.toBeNull();
});
it('picks the category from a fixed list', async () => {
  const { el } = await render();
  const select = el.querySelector('mat-select[aria-label="Category"]');
  expect(select).not.toBeNull();
  expect(el.querySelector('input[aria-label="Category"]')).toBeNull();
});
it('edits aliases with Material fields, not native controls', async () => {
  const { el, fixture } = await render('b:p');
  (el.querySelector('button[aria-label="Edit alias beton"]') as HTMLButtonElement).click();
  fixture.detectChanges();
  expect(el.querySelector('select')).toBeNull();
  expect(el.querySelector('mat-select[aria-label="Edit kind beton"]')).not.toBeNull();
  expect(
    el
      .querySelector('input[aria-label="Edit phrase beton"]')
      ?.classList.contains('mat-mdc-input-element'),
  ).toBe(true);
});
it('offers the shared PDF dropzone on the add screen and attaches the card after creating', async () => {
  const { el, api, fixture } = await render();
  expect(el.querySelector('[data-testid="pdf-dropzone"]')).not.toBeNull();
  const file = new File(['%PDF'], 'card.pdf', { type: 'application/pdf' });
  const input = el.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [file] });
  input.dispatchEvent(new Event('change'));
  fixture.detectChanges();
  expect(el.textContent).toContain('Selected: card.pdf');
  await fixture.componentInstance.saveProduct();
  expect(api.create).toHaveBeenCalled();
  expect(api.attachCard).toHaveBeenCalledWith('b:new', file, expect.any(String));
});
it('titles the screen Edit product before the product has loaded', async () => {
  TestBed.configureTestingModule({
    imports: [ProductEditorComponent],
    providers: [
      provideRouter([]),
      { provide: ProductAdminApi, useValue: { read: () => new Promise(() => {}) } },
    ],
  });
  const fixture = TestBed.createComponent(ProductEditorComponent);
  fixture.componentRef.setInput('productId', 'b:p');
  fixture.detectChanges();
  expect((fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent).toContain(
    'Edit product',
  );
});
it('lets HQ change a suggestion kind before accepting it, or accept all', async () => {
  const { el, api, fixture } = await render('b:p');
  const facade = fixture.componentInstance.facade;
  facade.suggestions.set([
    { phrase: 'betonik', kind: 'PHONETIC', collisions: [] },
    { phrase: 'pomada', kind: 'TYPE', collisions: ['Pomada Matowa'] },
  ]);
  fixture.detectChanges();
  expect(el.textContent).toContain('Also matches Pomada Matowa');
  expect(el.querySelector('mat-select[aria-label="Suggested kind betonik"]')).not.toBeNull();
  fixture.componentInstance.suggestionKinds.set('betonik', 'NAME');
  (el.querySelector('button[aria-label="Accept betonik"]') as HTMLButtonElement).click();
  await new Promise((r) => setTimeout(r));
  expect(api.saveAliases).toHaveBeenLastCalledWith(
    expect.objectContaining({ changes: [{ op: 'add', phrase: 'betonik', kind: 'NAME' }] }),
  );
  expect(el.querySelector('button[aria-label="Accept all suggestions"]')).not.toBeNull();
});
it('removes an accepted suggestion even after HQ edited its phrase', async () => {
  const { el, fixture } = await render('b:p');
  const facade = fixture.componentInstance.facade;
  facade.suggestions.set([{ phrase: 'betonik', kind: 'PHONETIC', collisions: [] }]);
  fixture.componentInstance.suggestionEdits.set('betonik', 'betonix');
  fixture.detectChanges();
  (el.querySelector('button[aria-label="Accept betonik"]') as HTMLButtonElement).click();
  await new Promise((r) => setTimeout(r));
  expect(facade.suggestions()).toEqual([]);
});
it('disables the form and Save and shows a progress bar while the product loads', async () => {
  const { el, fixture } = await render(
    'b:p',
    vi.fn().mockReturnValue(new Promise(() => undefined)),
  );
  await new Promise((r) => setTimeout(r, 250));
  fixture.detectChanges();
  expect(el.querySelector('[role="progressbar"]')).not.toBeNull();
  expect(el.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  expect(el.querySelector<HTMLInputElement>('input')!.disabled).toBe(true);
});
it('shows an empty state with Retry and no form when the product cannot load', async () => {
  const { el, fixture } = await render('b:p', vi.fn().mockRejectedValue(new Error('offline')));
  expect(el.querySelector('app-empty-state')).not.toBeNull();
  expect(el.textContent).toContain('Retry');
  expect(el.querySelector('form')).toBeNull();
  expect(fixture).toBeTruthy();
});
it('Retry after a load failure brings the form back with values and Save enabled', async () => {
  const read = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(detail);
  const { el, fixture } = await render('b:p', read);
  expect(el.querySelector('form')).toBeNull();
  [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Retry'))!.click();
  await fixture.whenStable();
  await new Promise((r) => setTimeout(r));
  fixture.detectChanges();
  expect(read).toHaveBeenCalledTimes(2);
  expect(el.querySelector('app-empty-state')).toBeNull();
  expect(el.querySelector<HTMLInputElement>('input')!.value).toBe('Pomada Cement');
  expect(el.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
});
