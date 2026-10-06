import 'global-jsdom/register';
import { BesserEditor, layoutModel, SVG, UMLModel } from '@besser/wme';
import { CSS_VARIABLE_FALLBACKS } from '@/constants';

/**
 * jsdom lacks the layout APIs React Flow relies on. Without these shims the
 * headless render throws inside React (`ResizeObserver is not defined`) —
 * which, being an uncaught render error, also took the whole server down.
 * Installed once, idempotently, before the first render.
 */
const installHeadlessDomShims = (): void => {
  // `any`: the server tsconfig has no DOM lib; jsdom provides these at runtime.
  const w = (globalThis as Record<string, any>).window as Record<string, any>;

  // JSDOM does not support getBBox (used by text measurement fallbacks).
  w.SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 10, height: 10 });

  if (typeof w.ResizeObserver === 'undefined') {
    // Report each observed element once (like a real observer's initial
    // notification) so React Flow runs its node-measurement pass.
    class HeadlessResizeObserver {
      private readonly callback: (entries: unknown[], observer: unknown) => void;
      private readonly targets = new Set<any>();
      constructor(callback: (entries: unknown[], observer: unknown) => void) {
        this.callback = callback;
      }
      observe(target: any) {
        this.targets.add(target);
        setTimeout(() => {
          if (!this.targets.has(target)) return;
          const rect = target.getBoundingClientRect();
          this.callback([{ target, contentRect: rect, borderBoxSize: [], contentBoxSize: [] }], this);
        }, 0);
      }
      unobserve(target: any) {
        this.targets.delete(target);
      }
      disconnect() {
        this.targets.clear();
      }
    }
    w.ResizeObserver = HeadlessResizeObserver;
    (globalThis as Record<string, any>).ResizeObserver = HeadlessResizeObserver;
  }

  if (typeof w.DOMMatrixReadOnly === 'undefined') {
    // React Flow reads the viewport zoom via `new DOMMatrixReadOnly(transform).m22`.
    class HeadlessDOMMatrixReadOnly {
      m22: number;
      constructor(transform?: string) {
        const scale = typeof transform === 'string' ? /scale\(([^)]+)\)/.exec(transform) : null;
        this.m22 = scale ? Number.parseFloat(scale[1]) || 1 : 1;
      }
    }
    w.DOMMatrixReadOnly = HeadlessDOMMatrixReadOnly;
    (globalThis as Record<string, any>).DOMMatrixReadOnly = HeadlessDOMMatrixReadOnly;
  }

  // jsdom never lays out, so offsetWidth/offsetHeight are always 0. Report the
  // inline pixel size React Flow writes on node wrappers (falling back to 0),
  // so measured node dimensions match the model instead of collapsing.
  const px = (value: string): number => {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  };
  const proto = w.HTMLElement.prototype as Record<string, unknown>;
  if (!w.__besserHeadlessOffsetShim) {
    Object.defineProperty(proto, 'offsetWidth', {
      configurable: true,
      get(this: any) {
        return px(this.style?.width ?? '');
      },
    });
    Object.defineProperty(proto, 'offsetHeight', {
      configurable: true,
      get(this: any) {
        return px(this.style?.height ?? '');
      },
    });
    w.__besserHeadlessOffsetShim = true;
  }

  // The webapp theme defines the `--besser-*` palette; headless nothing does, so
  // the standalone export snapshotted no colors and every fill/stroke rendered
  // black. Seed the library's light-theme defaults on :root.
  for (const [name, value] of Object.entries(CSS_VARIABLE_FALLBACKS)) {
    document.documentElement.style.setProperty(name, value);
  }
};

export class ConversionService {
  /**
   * @param model the UML model to render
   * @param autoLayout when true (default), runs ELK auto-layout on the model
   *   before rendering, so imported/headless models get a clean layout instead
   *   of whatever positions they arrived with.
   */
  convertToSvg = async (model: UMLModel, autoLayout = true): Promise<SVG> => {
    document.body.innerHTML = '<!doctype html><html lang="en"><body><div></div></body></html>';
    installHeadlessDomShims();
    const layoutedModel = autoLayout ? await layoutModel(model) : model;
    const container = document.querySelector('div')!;
    const editor = new BesserEditor(container, {});
    await editor.nextRender;
    editor.model = layoutedModel;
    await editor.nextRender;
    return editor.exportAsSVG();
  };
}
