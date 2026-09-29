/**
 * Install browser APIs used by dependencies that are not available in some TV
 * browsers. This must run before the app renders a game board.
 */
export function installBrowserCompat(): void {
  const arrayPrototype = Array.prototype as Array<unknown> & {
    at?: (index: number) => unknown;
  };

  if (typeof arrayPrototype.at === 'function') return;

  Object.defineProperty(arrayPrototype, 'at', {
    configurable: true,
    writable: true,
    value<T>(this: ArrayLike<T>, index: number): T | undefined {
      const length = Number(this.length) >>> 0;
      const integer = Number(index) || 0;
      const offset = integer < 0 ? Math.ceil(integer) : Math.floor(integer);
      const resolvedIndex = offset < 0 ? length + offset : offset;
      return resolvedIndex < 0 || resolvedIndex >= length ? undefined : this[resolvedIndex];
    },
  });
}

installBrowserCompat();
