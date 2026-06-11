import '@testing-library/jest-dom';

// Node >= 22 ships an experimental `localStorage` global that evaluates to
// `undefined` unless Node is started with `--localstorage-file`, and it
// shadows the jsdom implementation vitest would otherwise expose. Install an
// in-memory stand-in so storage-backed services keep working in tests
// regardless of the local Node version. No-op where jsdom's localStorage is
// already available (e.g. CI on Node 20).
if (globalThis.localStorage === undefined) {
  const store = new Map<string, string>();
  const memoryLocalStorage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => {
      store.clear();
    },
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryLocalStorage,
    configurable: true,
    writable: true,
  });
}
