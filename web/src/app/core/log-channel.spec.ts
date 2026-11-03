import { expect, it } from 'vitest';
import { channelFor } from './log-channel';

it('tells preview, live and local apart by hostname', () => {
  expect(channelFor('notbad-6be95--foundation-unesffgt.web.app')).toBe('preview');
  expect(channelFor('notbad-6be95.web.app')).toBe('live');
  expect(channelFor('notbad-6be95.firebaseapp.com')).toBe('live');
  expect(channelFor('localhost')).toBe('local');
  expect(channelFor('127.0.0.1')).toBe('local');
});
