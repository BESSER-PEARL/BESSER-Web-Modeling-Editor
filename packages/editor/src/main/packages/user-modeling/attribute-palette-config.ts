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
  },
  'Personal_Information.nationality_iso3166': {
    label: 'nationality',
    icons: {
      default: FLAG,
    },
  },
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
