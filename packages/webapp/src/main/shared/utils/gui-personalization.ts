import type { UMLModel, UserGuiPresentationSpec } from '@besser/wme';
import type { PageSnapshot } from './buildWebAppVersions';
import { aggregateProfilePersonalization } from './personalization-aggregation';
import { splitUserDiagramIntoProfiles } from './user-profile-graph';

export interface GuiProfileOption {
  id: string;
  name: string;
  model: UMLModel;
}

/** Keep single-profile tab IDs compatible with existing saved page variants. */
export function guiProfileOptions(
  diagrams: { id: string; title: string; model: UMLModel }[],
): GuiProfileOption[] {
  return diagrams.flatMap((diagram) => {
    const profiles = splitUserDiagramIntoProfiles(diagram.model);
    return profiles.map((profile) => ({
      id: profiles.length === 1 ? diagram.id : `${diagram.id}::${profile.rootBoxId}`,
      name: profiles.length === 1
        ? profile.name || diagram.title || 'Unnamed Profile'
        : `${profile.name || 'Unnamed Profile'} (${diagram.title})`,
      model: profile.model,
    }));
  });
}

/** Use the same root → boxes → attributes ordering as agent rules. */
export function aggregateGuiPresentation(model: UMLModel): UserGuiPresentationSpec {
  const presentation: UserGuiPresentationSpec = {};
  for (const { spec } of aggregateProfilePersonalization(model).specs) {
    for (const [field, value] of Object.entries(spec.gui?.presentation ?? {})) {
      if (value !== undefined && value !== null && value !== '' && value !== 'original') {
        Object.assign(presentation, { [field]: value });
      }
    }
  }
  return presentation;
}

/** Content adaptation is enabled by any contributing profile element, as for agents. */
export function aggregateGuiContent(model: UMLModel): { adaptContentToUserProfile?: boolean; summarizeLongContent?: boolean } {
  const content: ReturnType<typeof aggregateGuiContent> = {};
  for (const { spec } of aggregateProfilePersonalization(model).specs) {
    for (const field of ['adaptContentToUserProfile', 'summarizeLongContent'] as const) {
      if (spec.gui?.content?.[field] === true) content[field] = true;
    }
  }
  return content;
}

export function guiReadAloudEnabled(model: UMLModel): boolean {
  return aggregateProfilePersonalization(model).specs.some(({ spec }) => spec.gui?.modality?.readAloud === true);
}

const FONT_FAMILIES: Record<NonNullable<UserGuiPresentationSpec['font']>, string> = {
  sans: 'Arial, Helvetica, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  monospace: '"Courier New", Courier, monospace',
  neutral: 'system-ui, sans-serif',
  grotesque: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  condensed: '"Arial Narrow", "Roboto Condensed", sans-serif',
  // Readability-oriented fonts; web fonts are loaded via READABILITY_FONT_STYLESHEETS.
  hyperlegible: '"Atkinson Hyperlegible", Verdana, sans-serif',
  lexend: 'Lexend, Verdana, sans-serif',
  dyslexia: 'OpenDyslexic, "Comic Sans MS", Verdana, sans-serif',
  verdana: 'Verdana, Tahoma, sans-serif',
  fredoka: 'Fredoka, "Comic Sans MS", sans-serif',
};

/** Stylesheets providing the web fonts above (used by the GUI canvas). */
export const READABILITY_FONT_STYLESHEETS = [
  'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Lexend:wght@400;700&family=Fredoka:wght@400;700&display=swap',
  'https://cdn.jsdelivr.net/npm/@fontsource/opendyslexic/index.css',
];

const CONTRAST_PALETTES = {
  high: { color: '#000000', background: '#ffffff' },
  medium: { color: '#444444', background: '#f5f5f5' },
  low: { color: '#666666', background: '#dddddd' },
};

/** Pick the higher-contrast black/white background for an explicit hex color. */
function highContrastBackground(color: string): string {
  const hex = color.match(/^#([a-f\d]{6})$/i)?.[1];
  if (!hex) return '#ffffff';
  const channels = [0, 2, 4].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return (luminance + 0.05) / 0.05 > 1.05 / (luminance + 0.05) ? '#000000' : '#ffffff';
}

const RULE_MARKER = 'besserGuiPersonalization';
const NON_TEXT_TAGS = new Set(['img', 'svg', 'path', 'circle', 'rect', 'line', 'polygon', 'polyline', 'ellipse', 'g', 'canvas', 'video', 'audio', 'iframe', 'script', 'style']);
const NON_TEXT_TYPES = new Set(['image', 'svg', 'video', 'map', 'iframe', 'canvas', 'script', 'style']);
// React widgets render text outside the serialized GrapesJS component tree.
// Scope these selectors to the widget, so its inline defaults cannot hide rules.
const WIDGET_TEXT_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'button', 'label', 'input', 'textarea', 'select', 'option', 'table', 'th', 'td', 'li'];

const idSelector = (id: string): string => '#' + Array.from(id).map((char, index) =>
  /[a-zA-Z_-]/.test(char) || (index > 0 && /\d/.test(char)) ? char : `\\${char.codePointAt(0)!.toString(16)} `,
).join('');

/** Measure the live page before changing inherited fonts or widget defaults. */
export function captureGuiFontSizes(element: Node, id: string, widget = false): Record<string, number> {
  const sizes: Record<string, number> = {};
  // GrapesJS textnode views return DOM Text nodes. getComputedStyle requires
  // an Element; their font is already measured on the containing component.
  // Use nodeType instead of instanceof so iframe elements work too.
  if (element.nodeType !== 1) return sizes;
  const root = element as HTMLElement;
  const read = (node: HTMLElement, selector: string) => {
    const size = parseFloat(node.ownerDocument.defaultView?.getComputedStyle(node).fontSize ?? '');
    if (Number.isFinite(size) && size > 0) sizes[selector] = size;
  };
  const selector = idSelector(id);
  read(root, selector);
  if (widget) {
    const walk = (parent: Element, path: string) => {
      Array.from(parent.children).forEach((child) => {
        const tag = child.tagName.toLowerCase();
        if (NON_TEXT_TAGS.has(tag)) return;
        const index = Array.from(parent.children).filter((sibling) => sibling.tagName === child.tagName).indexOf(child) + 1;
        const childPath = `${path} > ${tag}:nth-of-type(${index})`;
        if (WIDGET_TEXT_TAGS.includes(tag)) read(child as HTMLElement, childPath);
        walk(child, childPath);
      });
    };
    walk(root, selector);
  }
  return sizes;
}

function fontPixels(value: unknown, inherited: number): number | undefined {
  if (typeof value === 'number') return value > 0 ? value : undefined;
  if (typeof value !== 'string') return undefined;
  const match = value.replace(/\s*!important\s*$/, '').trim().match(/^([\d.]+)(px|rem|em|%)?$/);
  if (!match) return undefined;
  const size = Number(match[1]);
  if (!Number.isFinite(size) || size <= 0) return undefined;
  return size * (match[2] === 'rem' ? 16 : match[2] === 'em' ? inherited : match[2] === '%' ? inherited / 100 : 1);
}

/** Offline fallback for saved models; live measurements cover the full cascade. */
function storedFontSize(component: any, css: any[], inherited: number): number | undefined {
  const id = component.attributes?.id;
  const classes = (component.classes ?? []).map((item: any) => typeof item === 'string' ? item : item.name);
  const tag = component.tagName || 'div';
  let selected: unknown;
  let priority = -1;
  css.forEach((rule) => {
    const value = rule.style?.['font-size'];
    if (value === undefined) return;
    const selectors = rule.selectorsAdd
      ? String(rule.selectorsAdd).split(',').map((part) => part.trim())
      : (rule.selectors ?? []).map((item: any) => typeof item === 'string' ? item : `${item.type === 2 ? '#' : '.'}${item.name}`);
    selectors.forEach((selector: string) => {
      const specificity = selector === `#${id}` ? 100 : classes.some((name: string) => selector === `.${name}` || selector === name) ? 10 : selector === tag ? 1 : -1;
      const rank = specificity + (String(value).includes('!important') ? 10000 : 0);
      if (specificity >= 0 && rank >= priority) { selected = value; priority = rank; }
    });
  });
  const inline = component.style?.['font-size'];
  if (inline !== undefined && 1000 + (String(inline).includes('!important') ? 10000 : 0) >= priority) selected = inline;
  return fontPixels(selected, inherited);
}

/** Apply only defined rules, preserving content, IDs, bindings, and structure. */
export function applyGuiPresentation(
  snapshot: PageSnapshot,
  presentation: UserGuiPresentationSpec,
  pageId: string,
): PageSnapshot {
  const result = structuredClone(snapshot);
  const style: Record<string, string> = {};
  if (presentation.size !== undefined && Number.isFinite(presentation.size) && presentation.size > 0) {
    style['font-size'] = `${presentation.size}px`;
  }
  if (presentation.font && FONT_FAMILIES[presentation.font]) style['font-family'] = FONT_FAMILIES[presentation.font];
  if (presentation.lineSpacing !== undefined && Number.isFinite(presentation.lineSpacing) && presentation.lineSpacing > 0) {
    style['line-height'] = String(presentation.lineSpacing);
  }
  if (presentation.alignment) style['text-align'] = presentation.alignment;
  if (presentation.contrast && CONTRAST_PALETTES[presentation.contrast]) {
    const palette = CONTRAST_PALETTES[presentation.contrast];
    style.color = palette.color;
    style['background-color'] = presentation.contrast === 'high' && presentation.color
      ? highContrastBackground(presentation.color)
      : palette.background;
  }
  // Explicit text color takes priority over the contrast preset's foreground.
  if (presentation.color) style.color = presentation.color;
  if (Object.keys(style).length === 0) return result;

  const importantStyle = Object.fromEntries(Object.entries(style).map(([key, value]) => [key, `${value} !important`]));
  const selectors = new Set<string>();
  const fontRules = new Map<number, Set<string>>();
  const addFontRule = (selector: string, size: number) => {
    if (!fontRules.has(size)) fontRules.set(size, new Set());
    fontRules.get(size)!.add(selector);
  };
  const requestedSize = style['font-size'] ? presentation.size! : undefined;
  delete importantStyle['font-size'];
  const visit = (component: any, inherited = 16) => {
    if (!component || typeof component !== 'object') return;
    const tag = String(component.tagName || '').toLowerCase();
    if (NON_TEXT_TAGS.has(tag) || NON_TEXT_TYPES.has(component.type)) return;
    const id = component.attributes?.id;
    const selector = typeof id === 'string' && id ? idSelector(id) : undefined;
    const storedSize = storedFontSize(component, snapshot.css, inherited);
    const headingScale: Record<string, number> = { h1: 2, h2: 1.5, h3: 1.17, h4: 1, h5: 0.83, h6: 0.67 };
    const measuredSize = selector ? snapshot.fontSizes?.[selector] : undefined;
    const originalSize = Math.max(measuredSize ?? storedSize ?? (headingScale[tag] ?? 1) * inherited, storedSize ?? 0);
    if (component.type !== 'textnode') {
      // Store on components too: the B-UML converter resolves component styles
      // for generated apps. Existing IDs also scope the CSS to this page's
      // components, avoiding global tag rules that would affect other pages.
      component.style = { ...component.style, ...importantStyle };
      if (requestedSize !== undefined) {
        const size = Math.max(originalSize, requestedSize);
        // Keep larger explicit pixel sizes verbatim. Resolve inherited/relative
        // sizes to pixels so growing a parent does not resize that text.
        const existing = component.style['font-size'];
        if (originalSize <= requestedSize || fontPixels(existing, inherited) !== originalSize || /(?:em|%)\s*(?:!important)?$/.test(String(existing))) {
          component.style['font-size'] = `${size}px !important`;
        }
        if (selector) addFontRule(selector, size);
      }
      if (selector) {
        selectors.add(selector);
        if (component.type === 'table') {
          WIDGET_TEXT_TAGS.forEach((tag) => {
            selectors.add(`${selector} ${tag}`);
            if (requestedSize !== undefined) {
              const defaultSize = tag === 'table' || tag === 'td' || tag === 'th' ? 14 : tag === 'h3' ? originalSize * 1.17 : 13;
              addFontRule(`${selector} ${tag}`, Math.max(defaultSize, requestedSize));
            }
          });
          if (requestedSize !== undefined) {
            for (const [path, size] of Object.entries(snapshot.fontSizes ?? {})) {
              if (path.startsWith(`${selector} > `)) addFontRule(path, Math.max(size, requestedSize));
            }
          }
        }
      }
    }
    if (Array.isArray(component.components)) component.components.forEach((child: any) => visit(child, originalSize));
  };
  result.components.forEach((component) => visit(component));
  result.css = result.css.filter((rule) => !rule?.[RULE_MARKER]);
  if (selectors.size > 0 && Object.keys(importantStyle).length > 0) {
    result.css.push({ selectors: [], selectorsAdd: [...selectors].join(', '), style: importantStyle, pageId, [RULE_MARKER]: true });
  }
  for (const [size, targets] of fontRules) {
    result.css.push({ selectors: [], selectorsAdd: [...targets].join(', '), style: { 'font-size': `${size}px !important` }, pageId, [RULE_MARKER]: true });
  }
  return result;
}
