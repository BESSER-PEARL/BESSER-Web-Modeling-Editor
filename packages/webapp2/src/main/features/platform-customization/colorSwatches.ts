/**
 * colorSwatches
 * -------------
 * Curated palette + WCAG contrast helper for the Platform Customization panel.
 * Eight defaults cover most "professional" picks with one click; users can still
 * dial in an exact CSS value via the native picker / text input.
 */

export const COLOR_SWATCHES: ReadonlyArray<{ name: string; value: string }> = [
  { name: 'Slate',    value: '#475569' },
  { name: 'Sky',      value: '#0ea5e9' },
  { name: 'Teal',     value: '#0d9488' },
  { name: 'Emerald',  value: '#10b981' },
  { name: 'Amber',    value: '#f59e0b' },
  { name: 'Rose',     value: '#f43f5e' },
  { name: 'Indigo',   value: '#6366f1' },
  { name: 'Stone',    value: '#78716c' },
];

/** Convert a CSS hex (#rrggbb or #rgb) to {r,g,b} 0–255. Returns null if not hex. */
function parseHex(color: string): { r: number; g: number; b: number } | null {
  if (!color) return null;
  let value = color.trim();
  if (value.startsWith('#')) value = value.slice(1);
  if (value.length === 3) value = value.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  const num = parseInt(value, 16);
  return { r: (num >> 16) & 0xff, g: (num >> 8) & 0xff, b: num & 0xff };
}

/** sRGB relative luminance per WCAG. */
function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** WCAG contrast ratio in [1, 21]. Returns null if either color is non-hex. */
export function contrastRatio(fg: string | undefined, bg: string | undefined): number | null {
  if (!fg || !bg) return null;
  const fgRgb = parseHex(fg);
  const bgRgb = parseHex(bg);
  if (!fgRgb || !bgRgb) return null;
  const a = relativeLuminance(fgRgb);
  const b = relativeLuminance(bgRgb);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/** True when the contrast ratio is below the conservative 3.0 threshold. */
export function hasLowContrast(fg: string | undefined, bg: string | undefined): boolean {
  const ratio = contrastRatio(fg, bg);
  return ratio !== null && ratio < 3.0;
}
