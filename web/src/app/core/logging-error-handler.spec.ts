import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expect, it, vi } from 'vitest';
import { ClientLog } from './client-log';
import { LoggingErrorHandler } from './logging-error-handler';

function setup() {
  const log = { record: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: ClientLog, useValue: log },
      { provide: ErrorHandler, useClass: LoggingErrorHandler },
    ],
  });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  return { log, handler: TestBed.inject(ErrorHandler) };
}

it('records an unhandled error by name and stack frames, without its message', () => {
  const { log, handler } = setup();
  handler.handleError(new TypeError('secret text'));
  expect(log.record).toHaveBeenCalledWith(
    'client.error.unhandled',
    'error',
    expect.objectContaining({ code: 'TypeError' }),
  );
  expect(JSON.stringify(log.record.mock.calls)).not.toContain('secret text');
  const details = log.record.mock.calls[0][2].details ?? {};
  expect(Object.keys(details).every((key) => /^frame[1-3]$/.test(key))).toBe(true);
});

it('prefers a string error code', () => {
  const { log, handler } = setup();
  handler.handleError(Object.assign(new Error('x'), { code: 'functions/internal' }));
  expect(log.record.mock.calls[0][2].code).toBe('functions/internal');
});

it('records a rejected non-error value', () => {
  const { log, handler } = setup();
  handler.handleError('just a string');
  expect(log.record).toHaveBeenCalledWith('client.error.unhandled', 'error', {
    code: 'unknown',
  });
});

it('drops a frame line that repeats the message, even with an @', () => {
  const { log, handler } = setup();
  const error = new Error('mail a@b.c failed');
  error.stack = 'Error: mail a@b.c failed\n    at send (main.js:1:2)';
  handler.handleError(error);
  expect(JSON.stringify(log.record.mock.calls)).not.toContain('a@b.c');
  expect(log.record.mock.calls[0][2].details).toEqual({ frame1: 'at send (main.js:1:2)' });
});
