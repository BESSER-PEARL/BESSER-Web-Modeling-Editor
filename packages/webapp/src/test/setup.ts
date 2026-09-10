import '@testing-library/jest-dom';

// jsdom has no canvas backend, but @besser/wme's SVG text-measurement helpers
// (packages/library/lib/utils/textUtils.ts) call `canvas.getContext('2d')` at
// module-eval time. Any webapp test that transitively imports @besser/wme
// (directly, or via a hook/component that does) crashes on import without
// this — matches the identical mock in packages/library/tests/setup.ts.
class MockCanvasRenderingContext2D {
  font = '';
  measureText(text: string) {
    return { width: text.length * 8 };
  }
  fillRect() {}
  clearRect() {}
  getImageData() {
    return { data: [] };
  }
  putImageData() {}
  createImageData() {
    return { data: [] };
  }
  setTransform() {}
  resetTransform() {}
  drawImage() {}
  save() {}
  restore() {}
  beginPath() {}
  moveTo() {}
  lineTo() {}
  closePath() {}
  stroke() {}
  fill() {}
  translate() {}
  scale() {}
  rotate() {}
  arc() {}
  arcTo() {}
  rect() {}
  clip() {}
}

HTMLCanvasElement.prototype.getContext = function () {
  return new MockCanvasRenderingContext2D() as unknown as CanvasRenderingContext2D;
} as unknown as typeof HTMLCanvasElement.prototype.getContext;

// Initialise i18next before any component renders so that t() resolves to real
// (English) strings in unit tests instead of returning raw keys. Resources are
// bundled synchronously, so translations are available immediately after import.
import i18n from '../main/shared/i18n';
void i18n.changeLanguage('en');

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
