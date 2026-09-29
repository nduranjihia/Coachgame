import { afterEach, describe, expect, it } from 'vitest';
import { installBrowserCompat } from './browserCompat';

const originalAt = Object.getOwnPropertyDescriptor(Array.prototype, 'at');

afterEach(() => {
  if (originalAt) Object.defineProperty(Array.prototype, 'at', originalAt);
  else delete (Array.prototype as { at?: unknown }).at;
});

describe('installBrowserCompat', () => {
  it('adds Array.prototype.at for older browsers', () => {
    delete (Array.prototype as { at?: unknown }).at;

    installBrowserCompat();

    const at = (['white', 'black'] as unknown as { at(index: number): string | undefined }).at;
    expect(at.call(['white', 'black'], -1)).toBe('black');
    expect(at.call(['white', 'black'], 2)).toBeUndefined();
  });

  it('does not replace a browser-provided implementation', () => {
    const at = () => 'native';
    Object.defineProperty(Array.prototype, 'at', { configurable: true, value: at });

    installBrowserCompat();

    expect((Array.prototype as { at?: unknown }).at).toBe(at);
  });
});
