import { ILayer } from '../../services/layouter/layer';

// Measuring forces a synchronous layout, and relationship recalcs measure every label on every
// drag step, so sizes are cached per (styles, value). Cleared when web fonts finish loading.
const sizeCache = new Map<string, { width: number; height: number }>();
const MAX_CACHED = 5000;
if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.addEventListener?.('loadingdone', () => sizeCache.clear());
}

export class Text {
  static size = (
    layer: ILayer,
    value: string,
    styles?: Partial<CSSStyleDeclaration>,
  ): { width: number; height: number } => {
    const svg = layer.layer;
    if (!svg) {
      return { width: 0, height: 0 };
    }

    const key = `${styles ? JSON.stringify(styles) : ''}|${value}`;
    const cached = sizeCache.get(key);
    if (cached) {
      return { ...cached };
    }

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    Object.assign(text.style, {
      ...styles,
      visibility: 'hidden',
    });
    text.appendChild(document.createTextNode(value));
    svg.appendChild(text);

    const bounds = text.getBBox();
    svg.removeChild(text);
    const size = { width: bounds.width, height: bounds.height };
    // A detached or not-yet-rendered layer measures 0; don't pin that.
    if (size.width > 0 || !value) {
      if (sizeCache.size >= MAX_CACHED) sizeCache.clear();
      sizeCache.set(key, size);
    }
    return { ...size };
  };
}
