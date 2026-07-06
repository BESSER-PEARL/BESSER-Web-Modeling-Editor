/**
 * markTextEditable — walk a GrapesJS component / project-data tree and make
 * text components inline-editable.
 *
 * GrapesJS only enters double-click inline editing when a component has BOTH
 * `type: 'text'` AND `editable: true`. Models pushed through `loadProjectData`
 * or `updateDiagramModelThunk` use their component defs verbatim (the
 * preset-webpage plugin defaults are NOT applied), so agent-generated text
 * arrives "locked" — it can be moved/copied/deleted but not edited.
 *
 * This walker fixes that in two ways:
 *  1. Existing `type: 'text'` nodes get `editable: true`.
 *  2. Bare text-bearing tags the agent emits WITHOUT a type (e.g. a `<p>` whose
 *     only children are text / textnodes) are coerced to `type: 'text'` +
 *     `editable: true`. Container elements that hold child *elements* are left
 *     untouched so a layout node is never turned into a text node.
 *
 * The tree is mutated in place; the same node is returned for convenience.
 */

/** Tags that hold editable text and can be safely coerced to `type: 'text'`. */
const TEXT_BEARING_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'span',
  'a',
  'li',
  'label',
  'blockquote',
]);

/**
 * A child counts as "text only" when it is a raw string, a GrapesJS textnode,
 * or a bare content node with no tag and no nested components. Anything with a
 * `tagName` or child components is an element child and disqualifies coercion.
 */
function childIsTextOnly(child: unknown): boolean {
  if (typeof child === 'string') return true;
  if (child && typeof child === 'object') {
    const c = child as Record<string, unknown>;
    if (c.type === 'textnode') return true;
    const hasElementShape =
      typeof c.tagName === 'string' ||
      (Array.isArray(c.components) && (c.components as unknown[]).length > 0);
    if (!hasElementShape) return true;
  }
  return false;
}

/**
 * True when `node` is a bare text-bearing tag (untyped or already text) whose
 * children are all text — safe to mark as an editable text component.
 */
function isCoercibleTextTag(node: Record<string, unknown>): boolean {
  if (typeof node.tagName !== 'string') return false;
  if (!TEXT_BEARING_TAGS.has(node.tagName.toLowerCase())) return false;
  // Never override an explicit component type (e.g. 'link', 'image', a custom
  // component) — only coerce bare tags the agent left untyped.
  if (node.type && node.type !== 'text') return false;

  const children = node.components;
  if (children == null) return true; // empty tag — safe to treat as text
  if (!Array.isArray(children)) return false;
  return children.every(childIsTextOnly);
}

export function markTextEditable<T>(node: T): T {
  if (Array.isArray(node)) {
    node.forEach((child) => markTextEditable(child));
    return node;
  }
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (obj.type === 'text') {
      obj.editable = true;
    } else if (isCoercibleTextTag(obj)) {
      obj.type = 'text';
      obj.editable = true;
    }
    // Recurse into every property (covers `components`, `pages`, `frames`, …)
    // exactly like the original in-place walker did.
    for (const key of Object.keys(obj)) {
      markTextEditable(obj[key]);
    }
  }
  return node;
}
