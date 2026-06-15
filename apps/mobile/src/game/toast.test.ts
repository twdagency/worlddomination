import { describe, expect, it } from 'vitest';
import { clearToastState, nextToastState } from './toastQueue';

describe('toast queue management', () => {
  it('replaces the visible toast when a new message arrives', () => {
    const first = nextToastState(null, 'Queued', 'info', '1');
    const second = nextToastState(first, 'Replacement', 'success', '2');
    expect(second.message).toBe('Replacement');
    expect(second.tone).toBe('success');
  });

  it('clears the queue slot', () => {
    expect(clearToastState()).toBeNull();
  });
});
