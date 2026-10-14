/**
 * Installs a fresh `localStorage` / `sessionStorage` on the test global.
 *
 * Why this is needed: Node >= 26 defines `localStorage` and `sessionStorage`
 * on `globalThis` itself. Vitest's jsdom environment copies window properties
 * onto the global only when the key is absent or is in its own `KEYS` list
 * (`getWindowKeys`: `if (k in global) return keysArray.includes(k)`), and
 * neither storage key is in that list. So Node's globals shadow jsdom's:
 * `localStorage` reads back as `undefined` (Node needs `--localstorage-file`)
 * and `sessionStorage` is one process-wide store shared by every test file in
 * a worker.
 *
 * The replacement is installed unconditionally so the test environment does
 * not vary with the Node version, and per setup run so each test file starts
 * empty.
 *
 * Must be imported before anything that touches storage while loading — the
 * i18n language detector reads `localStorage` during module init.
 */

// Not `implements Storage`: the DOM's Storage interface carries an index
// signature that a class cannot satisfy. The shape is checked at the
// defineProperty call below instead.
class MemoryStorage {
  private readonly entries = new Map<string, string>();

  get length(): number {
    return this.entries.size;
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null;
  }

  getItem(key: string): string | null {
    const value = this.entries.get(String(key));
    return value === undefined ? null : value;
  }

  setItem(key: string, value: string): void {
    this.entries.set(String(key), String(value));
  }

  removeItem(key: string): void {
    this.entries.delete(String(key));
  }

  clear(): void {
    this.entries.clear();
  }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  Object.defineProperty(globalThis, name, {
    value: new MemoryStorage() as unknown as Storage,
    configurable: true,
    writable: true,
  });
}

// Every test starts with empty storage. While `localStorage` read back as
// `undefined`, anything that persisted state silently kept none, and tests
// were written against that. RateLimiterService is the example: it persists
// `lastRequestTime` and refuses a second request inside 1.5 s, so without this
// reset one test's send makes the next test's send a no-op.
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
