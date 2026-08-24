/**
 * Attribute-level palette configuration.
 *
 * Maps `${className}.${attributeName}` to a draggable palette chip: a label and
 * a set of value-based SVG icons. This drives the "attribute-granular" user
 * profile editor — instead of only dragging whole classes onto the canvas, the
 * user can drag a single attribute (e.g. `gender`) that renders as an icon.
 *
 * IMPORTANT: this is a pure concrete-syntax layer. A chip dropped on the canvas
 * is still a real instance of its container class (`Personal_Information`)
 * carrying the one configured attribute, so the underlying B-UML metamodel,
 * serialization, and downstream generators are unchanged.
 *
 * The `icons` map is keyed by attribute value; `default` is used while the
 * attribute has no value yet (as in the palette). SVGs are full `<svg>` strings
 * with an explicit `width`/`height`/`viewBox` (the layouter reads those to size
 * the icon) and use `currentColor` so they follow the editor theme.
 */

export interface AttributePaletteConfig {
  /** Human-readable label shown on the chip (defaults to the attribute name). */
  label: string;
  /** value -> SVG string. `default` is the fallback / unset icon. */
  icons: Record<string, string> & { default: string };
  /**
   * When true, the icon-view chip overlays the attribute's current value (with
   * its comparison operator, e.g. "≥ 18") as a text cue beneath the glyph. Use
   * for open-valued attributes (age, nationality) where a single static glyph
   * can't convey the value — as opposed to gender, whose glyph already differs
   * per value.
   */
  showValue?: boolean;
}

// Rendered size in px. The viewBox stays 24x24, so the artwork scales up to fill
// this. The layouter reads width/height to size the icon bounds, so bumping this
// enlarges the icon consistently in both the palette and on the canvas.
const ICON_SIZE = 48;

// Brand accent used for the attribute chips (gender/age/nationality) so they
// read as a distinct, consistent set rather than following the theme text color.
const CHIP_COLOR = '#1587d1';

const strokeSvg = (body: string, stroke: string = 'currentColor'): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 24 24" ` +
  `fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" ` +
  `stroke-linejoin="round">${body}</svg>`;

// ♀ Venus
const VENUS = strokeSvg('<circle cx="12" cy="8" r="5"/><line x1="12" y1="13" x2="12" y2="22"/><line x1="9" y1="19" x2="15" y2="19"/>', CHIP_COLOR);
// ♂ Mars
const MARS = strokeSvg('<circle cx="10" cy="14" r="5"/><line x1="13.6" y1="10.4" x2="19" y2="5"/><polyline points="14.5 5 19 5 19 9.5"/>', CHIP_COLOR);
// Neutral person (used for "Other" and the unset/default state)
const PERSON = strokeSvg('<circle cx="12" cy="8" r="4"/><path d="M6 21v-1a6 6 0 0 1 12 0v1"/>', CHIP_COLOR);
// 📅 Calendar (age)
const CALENDAR = strokeSvg(
  '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>' +
    '<line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  CHIP_COLOR,
);
// 🏳 Flag (nationality)
const FLAG = strokeSvg('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>', CHIP_COLOR);

/**
 * Palette chips: the design-level attributes of `Personal_Information`, each
 * exposed as its own draggable element (instead of dragging the whole
 * `Personal_Information` grouping). Add entries here to expose more attributes;
 * a class that has ≥1 entry is decomposed into chips by the palette composer,
 * a class with none is drawn as a whole grouping box (Culture, Language, …).
 */
export const ATTRIBUTE_PALETTE_CONFIG: Record<string, AttributePaletteConfig> = {
  'Personal_Information.gender': {
    label: 'gender',
    icons: {
      default: PERSON,
      Female: VENUS,
      Male: MARS,
      Other: PERSON,
    },
  },
  'Personal_Information.age': {
    label: 'age',
    icons: {
      default: CALENDAR,
    },
    showValue: true,
  },
  'Personal_Information.nationality_iso3166': {
    label: 'nationality',
    icons: {
      default: FLAG,
    },
    showValue: true,
  },
};

/**
 * Grouping-box classes (drawn as a whole box, not decomposed into chips) whose
 * icon-view glyph should still carry a value cue. Maps the class name to the
 * attribute whose value is shown beneath its class icon. `Language` keeps both
 * of its attributes in the model; only the language code (`iso693_3`) is
 * surfaced as the visual cue.
 */
export const BOX_VALUE_ATTRIBUTE: Record<string, string> = {
  Language: 'iso693_3',
};

/** Look up a chip config for a given class + attribute, if one exists. */
export const getAttributePaletteConfig = (
  className: string | undefined,
  attributeName: string | undefined,
): AttributePaletteConfig | undefined => {
  if (!className || !attributeName) return undefined;
  return ATTRIBUTE_PALETTE_CONFIG[`${className}.${attributeName}`];
};

/** Resolve the SVG icon for a value (falls back to `default` when unset/unknown). */
export const resolveAttributeIcon = (
  config: AttributePaletteConfig,
  value?: string,
): string => {
  if (value && config.icons[value]) return config.icons[value];
  return config.icons.default;
};

/** Comparison operator → display glyph (equality is implied, so shown value-only). */
const OPERATOR_SYMBOL: Record<string, string> = {
  '>=': '≥',
  '<=': '≤',
  '>': '>',
  '<': '<',
  '==': '',
  '=': '',
};

/** Format a criterion value for the cue, prefixing the operator when meaningful (e.g. "≥ 18"). */
export const formatCriterionValue = (operator: string | undefined, value: string): string => {
  const symbol = operator ? OPERATOR_SYMBOL[operator] ?? '' : '';
  return symbol ? `${symbol} ${value}` : value;
};

const escapeXml = (raw: string): string =>
  raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Force a glyph SVG to a fixed square size and offset (so 48px chips and 96px class icons compose alike). */
const placeGlyph = (svg: string, size: number, x: number, y: number): string =>
  svg
    .replace(/\bwidth="[^"]*"/, `width="${size}"`)
    .replace(/\bheight="[^"]*"/, `height="${size}"`)
    .replace(/<svg\b/, `<svg x="${x}" y="${y}"`);

/**
 * Compose a glyph with a value label beneath it into a single SVG string, used
 * as the icon-view cue for open-valued attributes. The outer `width`/`height`
 * are explicit so the canvas layouter can size and centre the icon.
 *
 * The value text carries its colour as an inline `style` (not just the `fill`
 * presentation attribute) so it wins over any editor CSS that colours `<text>`,
 * matching the icon blue exactly.
 */
export const composeIconWithValue = (glyph: string, text: string): string => {
  const glyphSize = ICON_SIZE;
  const gap = 6; // breathing room between the glyph and the value text
  const fontSize = 14;
  const width = Math.max(glyphSize + 8, text.length * 9 + 12);
  const baseline = glyphSize + gap + fontSize; // text baseline sits below the glyph
  const height = baseline + 6; // descender padding so the text is never clipped
  const glyphX = (width - glyphSize) / 2;
  const placed = placeGlyph(glyph, glyphSize, glyphX, 0);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    placed +
    `<text x="${width / 2}" y="${baseline}" text-anchor="middle" font-family="sans-serif" ` +
    `font-size="${fontSize}" font-weight="600" fill="${CHIP_COLOR}" style="fill:${CHIP_COLOR}">` +
    `${escapeXml(text)}</text>` +
    `</svg>`
  );
};

/** Split a criterion like `gender = Female` or `age >= 18` into name, operator, value. */
const parseCriterion = (raw: string): { name: string; operator?: string; value: string } => {
  const match = raw.match(/^(.*?)\s*(<=|>=|==|=|<|>)\s*(.*)$/);
  if (!match) return { name: raw.trim(), value: '' };
  return { name: match[1].trim(), operator: match[2], value: match[3].trim() };
};

/**
 * Resolve the icon-view SVG for a User-profile element, shared by the canvas
 * layouter (which sizes the element box from it) and the React icon component
 * (which renders it) so the box always fits exactly what is drawn. Pure over the
 * concrete syntax — the underlying model is unchanged. Returns null when the
 * element keeps its stored icon unchanged (no value cue applies).
 *
 *  - Attribute chip (`displayLabel` set): glyph swaps per value (gender ♀/♂);
 *    for `showValue` attributes (age, nationality) the value is overlaid.
 *  - Grouping box (class in `BOX_VALUE_ATTRIBUTE`, e.g. Language): the class
 *    icon is kept with the cue attribute's value overlaid.
 */
export const resolveUserModelChipIcon = (params: {
  className?: string;
  displayLabel?: string;
  fallbackIcon?: string;
  attributeNames: string[];
}): string | null => {
  const { className, displayLabel, fallbackIcon, attributeNames } = params;
  if (!className) return null;

  // Case 1: attribute chip (single configured attribute, header shows displayLabel).
  if (displayLabel) {
    const first = attributeNames[0];
    if (!first) return null;
    const { name, operator, value } = parseCriterion(first);
    const config = getAttributePaletteConfig(className, name);
    if (!config) return null;
    const glyph = resolveAttributeIcon(config, value || undefined);
    if (config.showValue && value) {
      return composeIconWithValue(glyph, formatCriterionValue(operator, value));
    }
    return glyph;
  }

  // Case 2: grouping box with a configured value cue (e.g. Language.iso693_3).
  const cueAttribute = BOX_VALUE_ATTRIBUTE[className];
  if (cueAttribute && fallbackIcon) {
    const match = attributeNames.map(parseCriterion).find((c) => c.name === cueAttribute);
    const value = match?.value ?? '';
    return value ? composeIconWithValue(fallbackIcon, value) : null;
  }

  return null;
};
