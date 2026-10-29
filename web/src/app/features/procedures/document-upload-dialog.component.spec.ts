import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { expect, it, vi } from 'vitest';
import type { LegacyCreateDocumentInput } from '../../../../../shared/contracts/knowledge/index';
import { DocumentUploadDialogComponent } from './document-upload-dialog.component';
import { DocumentUploadFacade } from './library/document-upload.facade';

function setup(data: Record<string, unknown> = {}, busy = false) {
  const selected = signal('');
  const error = signal('');
  const facade = {
    data,
    recoveredRegistration: signal(null),
    unknownRegistration: signal(false),
    busy: signal(busy),
    registered: signal(null),
    fileName: selected,
    error,
    submitLabel: () => 'Register and upload',
    selectFiles: vi.fn((files: FileList | readonly File[] | null) => {
      selected.set(files?.[0]?.name ?? '');
    }),
    submit: vi.fn(),
  };
  TestBed.configureTestingModule({
    imports: [DocumentUploadDialogComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close: vi.fn(), disableClose: false } },
    ],
  });
  TestBed.overrideComponent(DocumentUploadDialogComponent, {
    set: { providers: [{ provide: DocumentUploadFacade, useValue: facade }] },
  });
  const fixture = TestBed.createComponent(DocumentUploadDialogComponent);
  fixture.detectChanges();
  return { fixture, facade };
}

function fileList(...files: File[]): FileList {
  return {
    ...files,
    length: files.length,
    item: (index: number) => files[index] ?? null,
  } as unknown as FileList;
}

it('names and locks the frozen fields when recovering a new-document registration', async () => {
  const pending: LegacyCreateDocumentInput = {
    title: 'Frozen Guide A',
    language: 'pl',
    sourceType: 'public-product-summary',
    sourceUrls: ['https://example.test/guide'],
    observedOn: '2026-10-01',
    sha256: 'c'.repeat(64),
    idempotencyKey: 'same-command-key',
  };
  const facade = {
    data: {},
    recoveredRegistration: signal(pending),
    unknownRegistration: signal(true),
    busy: signal(false),
    registered: signal(null),
    fileName: signal(''),
    error: signal(''),
    submitLabel: () => 'Retry same registration',
    selectFiles: vi.fn(),
    submit: vi.fn(),
  };
  TestBed.configureTestingModule({
    imports: [DocumentUploadDialogComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: {} },
      { provide: MatDialogRef, useValue: { close: vi.fn(), disableClose: false } },
    ],
  });
  TestBed.overrideComponent(DocumentUploadDialogComponent, {
    set: { providers: [{ provide: DocumentUploadFacade, useValue: facade }] },
  });
  const fixture = TestBed.createComponent(DocumentUploadDialogComponent);
  await fixture.whenStable();
  fixture.detectChanges();
  expect(fixture.nativeElement.textContent).toContain('Frozen Guide A');
  expect(fixture.componentInstance.form.getRawValue()).toEqual({
    title: pending.title,
    language: pending.language,
    kind: 'product-catalog',
    origin: 'public-compilation',
    sourceUrls: pending.sourceUrls.join('\n'),
    observedOn: pending.observedOn,
  });
  expect(fixture.componentInstance.form.disabled).toBe(true);
});

it('routes a PDF selected with Browse through the shared file-selection path', () => {
  const { fixture, facade } = setup();
  const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['pdf'], 'guide.pdf', { type: 'application/pdf' });
  let inputValue = 'C:\\fakepath\\guide.pdf';
  Object.defineProperty(input, 'value', {
    configurable: true,
    get: () => inputValue,
    set: (value: string) => {
      inputValue = value;
    },
  });
  Object.defineProperty(input, 'files', { configurable: true, value: fileList(file) });
  input.dispatchEvent(new Event('change'));
  expect(facade.selectFiles).toHaveBeenCalledOnce();
  expect(facade.fileName()).toBe('guide.pdf');
  expect(input.value).toBe('');
});

it('routes a dropped PDF through the same file-selection path', () => {
  const { fixture, facade } = setup();
  const zone = fixture.nativeElement.querySelector('[data-testid="pdf-dropzone"]');
  const file = new File(['pdf'], 'dropped.pdf', { type: 'application/pdf' });
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: { files: fileList(file), types: ['Files'] },
  });
  zone.dispatchEvent(event);
  expect(facade.selectFiles).toHaveBeenCalledOnce();
  expect(facade.fileName()).toBe('dropped.pdf');
});

it('rejects multiple dropped files through the shared selector', () => {
  const { fixture, facade } = setup();
  const zone = fixture.nativeElement.querySelector('[data-testid="pdf-dropzone"]');
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      files: fileList(
        new File(['1'], 'one.pdf', { type: 'application/pdf' }),
        new File(['2'], 'two.pdf', { type: 'application/pdf' }),
      ),
      types: ['Files'],
    },
  });
  zone.dispatchEvent(event);
  expect(facade.selectFiles).toHaveBeenCalledOnce();
  expect(facade.selectFiles.mock.calls[0][0]?.length).toBe(2);
});

it('does not allow picker or drop changes while the facade is busy', () => {
  const { fixture, facade } = setup({}, true);
  const zone = fixture.nativeElement.querySelector('[data-testid="pdf-dropzone"]');
  const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
  const browse = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  expect(input.disabled).toBe(true);
  expect(input.tabIndex).toBe(-1);
  expect(browse.textContent?.trim()).toBe('Browse');
  const dragover = new Event('dragover', { bubbles: true, cancelable: true });
  Object.defineProperty(dragover, 'dataTransfer', { value: { types: ['Files'] } });
  zone.dispatchEvent(dragover);
  expect(dragover.defaultPrevented).toBe(true);
  const drop = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(drop, 'dataTransfer', {
    value: {
      files: fileList(new File(['pdf'], 'late.pdf', { type: 'application/pdf' })),
      types: ['Files'],
    },
  });
  zone.dispatchEvent(drop);
  expect(drop.defaultPrevented).toBe(true);
  expect(facade.selectFiles).not.toHaveBeenCalled();
});

it('cancels browser navigation for file drag events while busy', () => {
  const { fixture, facade } = setup({}, true);
  const zone = fixture.nativeElement.querySelector('[data-testid="pdf-dropzone"]');
  const dragover = new Event('dragover', { bubbles: true, cancelable: true });
  Object.defineProperty(dragover, 'dataTransfer', { value: { types: ['Files'] } });
  zone.dispatchEvent(dragover);
  const drop = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(drop, 'dataTransfer', {
    value: {
      files: fileList(new File(['pdf'], 'late.pdf', { type: 'application/pdf' })),
      types: ['Files'],
    },
  });
  zone.dispatchEvent(drop);
  expect(dragover.defaultPrevented).toBe(true);
  expect(drop.defaultPrevented).toBe(true);
  expect(facade.selectFiles).not.toHaveBeenCalled();
});

it('keeps the hidden picker out of the tab order and exposes a visible Browse button', () => {
  const { fixture } = setup();
  const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
  const browse = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  expect(input.tabIndex).toBe(-1);
  expect(browse.textContent?.trim()).toBe('Browse');
  expect(browse.disabled).toBe(false);
});

it('allows choosing the same PDF again after an invalid drop clears selection', () => {
  const selected = signal('');
  const error = signal('');
  const data = {};
  const facade = {
    data,
    recoveredRegistration: signal(null),
    unknownRegistration: signal(false),
    busy: signal(false),
    registered: signal(null),
    fileName: selected,
    error,
    submitLabel: () => 'Register and upload',
    submit: vi.fn(),
    selectFiles: vi.fn((files: FileList | readonly File[] | null) => {
      selected.set('');
      error.set('');
      const file = files?.[0];
      if (!file) return;
      if (file.type !== 'application/pdf' || !file.name.endsWith('.pdf')) {
        error.set('Choose a PDF file.');
        return;
      }
      selected.set(file.name);
    }),
  };
  TestBed.configureTestingModule({
    imports: [DocumentUploadDialogComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close: vi.fn(), disableClose: false } },
    ],
  });
  TestBed.overrideComponent(DocumentUploadDialogComponent, {
    set: { providers: [{ provide: DocumentUploadFacade, useValue: facade }] },
  });
  const fixture = TestBed.createComponent(DocumentUploadDialogComponent);
  fixture.detectChanges();
  const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
  const valid = new File(['pdf'], 'guide.pdf', { type: 'application/pdf' });
  let inputValue = 'C:\\fakepath\\guide.pdf';
  Object.defineProperty(input, 'value', {
    configurable: true,
    get: () => inputValue,
    set: (value: string) => {
      inputValue = value;
    },
  });
  Object.defineProperty(input, 'files', { configurable: true, value: fileList(valid) });
  input.dispatchEvent(new Event('change'));
  expect(facade.fileName()).toBe('guide.pdf');
  expect(input.value).toBe('');

  const zone = fixture.nativeElement.querySelector('[data-testid="pdf-dropzone"]');
  const invalid = new File(['text'], 'notes.txt', { type: 'text/plain' });
  const drop = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(drop, 'dataTransfer', {
    value: { files: fileList(invalid), types: ['Files'] },
  });
  zone.dispatchEvent(drop);
  expect(facade.fileName()).toBe('');

  input.dispatchEvent(new Event('change'));
  expect(facade.selectFiles).toHaveBeenCalledTimes(3);
  expect(facade.fileName()).toBe('guide.pdf');
});

it('renders the same drop zone for a resumed upload', () => {
  const { fixture } = setup({ resume: { title: 'Guide', version: '1.0' } });
  expect(fixture.nativeElement.querySelector('[data-testid="pdf-dropzone"]')).not.toBeNull();
  expect(fixture.nativeElement.textContent).toContain('Select the matching PDF');
});

it('offers independent kind and origin without changing provenance when kind changes', () => {
  const { fixture } = setup();
  const form = fixture.componentInstance.form;
  expect(fixture.nativeElement.textContent).toContain('Document kind');
  expect(fixture.nativeElement.textContent).toContain('Origin');
  expect(form.getRawValue()).toMatchObject({ kind: 'procedure', origin: 'synthetic' });
  form.patchValue({ kind: 'product-card', origin: 'official' });
  form.patchValue({ kind: 'policy' });
  expect(form.getRawValue()).toMatchObject({ kind: 'policy', origin: 'official' });
});
it('prefills replacement product metadata and provenance while retaining explicit changes', () => {
  const target = {
    documentId: 'DOC',
    documentRevision: 2,
    title: 'Catalog',
    version: 'v1',
    language: 'pl',
    kind: 'product-catalog',
    origin: 'public-compilation',
    sourceUrls: ['https://example.test/catalog'],
    observedOn: '2026-10-01',
  };
  const { fixture } = setup({ replaceTarget: target });
  const form = fixture.componentInstance.form;
  expect(form.getRawValue()).toEqual({
    title: 'Catalog',
    language: 'pl',
    kind: 'product-catalog',
    origin: 'public-compilation',
    sourceUrls: 'https://example.test/catalog',
    observedOn: '2026-10-01',
  });
  form.controls.kind.setValue('product-card');
  fixture.detectChanges();
  expect(form.controls.kind.value).toBe('product-card');
});
