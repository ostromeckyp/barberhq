import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DelayedLoadingDirective } from './delayed-loading';

@Component({
  standalone: true,
  imports: [DelayedLoadingDirective],
  template: '<span *appDelayedLoading="active()">Loading</span>',
})
class LoadingHost {
  readonly active = signal(true);
}

describe('DelayedLoadingDirective', () => {
  let fixture: ComponentFixture<LoadingHost>;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await TestBed.configureTestingModule({ imports: [LoadingHost] }).compileComponents();
    fixture = TestBed.createComponent(LoadingHost);
  });

  afterEach(() => {
    fixture?.destroy();
    vi.useRealTimers();
  });

  it('keeps short activity hidden and cancels its timer', async () => {
    await fixture.whenStable();
    await vi.advanceTimersByTimeAsync(120);
    expect(fixture.nativeElement.textContent).not.toContain('Loading');
    fixture.componentInstance.active.set(false);
    await fixture.whenStable();
    await vi.advanceTimersByTimeAsync(200);

    expect(fixture.nativeElement.textContent).not.toContain('Loading');
  });

  it('shows initially active content after 200ms and hides immediately on completion', async () => {
    await fixture.whenStable();
    await vi.advanceTimersByTimeAsync(199);
    expect(fixture.nativeElement.textContent).not.toContain('Loading');
    await vi.advanceTimersByTimeAsync(1);
    expect(fixture.nativeElement.textContent).toContain('Loading');

    fixture.componentInstance.active.set(false);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).not.toContain('Loading');
  });

  it('restarts the delay when a new active period begins', async () => {
    await fixture.whenStable();
    await vi.advanceTimersByTimeAsync(150);
    fixture.componentInstance.active.set(false);
    await fixture.whenStable();
    fixture.componentInstance.active.set(true);
    await fixture.whenStable();
    await vi.advanceTimersByTimeAsync(199);
    expect(fixture.nativeElement.textContent).not.toContain('Loading');
    await vi.advanceTimersByTimeAsync(1);
    expect(fixture.nativeElement.textContent).toContain('Loading');
  });

  it('cancels pending work and removes the view when destroyed', async () => {
    await fixture.whenStable();
    fixture.destroy();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(250);

    expect(fixture.nativeElement.textContent).not.toContain('Loading');
  });
});
