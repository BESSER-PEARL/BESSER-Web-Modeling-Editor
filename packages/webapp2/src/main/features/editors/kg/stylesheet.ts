/** Color per KG node type — palette swatches and canvas nodes stay in sync. */
export const KG_NODE_COLORS: Record<string, { fill: string; border: string; text: string }> = {
  class:      { fill: '#2563eb', border: '#1d4ed8', text: '#ffffff' },
  individual: { fill: '#f97316', border: '#c2410c', text: '#1f2937' },
  property:   { fill: '#16a34a', border: '#15803d', text: '#ffffff' },
  literal:    { fill: '#facc15', border: '#ca8a04', text: '#1f2937' },
  blank:      { fill: '#9ca3af', border: '#4b5563', text: '#1f2937' },
};

// Typed as `any[]` because the `Stylesheet` type alias isn't reachable under
// the `export = cytoscape` pattern — `cytoscape.StylesheetStyle` / `StylesheetCSS`
// are, but interface-member style declarations below mix numeric/string
// property values that the Css.Node interface doesn't enumerate exhaustively.
export const kgStylesheet: any[] = [
  {
    selector: 'node',
    style: {
      label: 'data(label)',
      'text-valign': 'center',
      'text-halign': 'center',
      'font-size': 12,
      'font-family': 'system-ui, -apple-system, Segoe UI, sans-serif',
      color: '#1f2937',
      // Fixed minimum size guarantees that any node (even one whose label is
      // very short or absent) remains clickable; labels extend the node via
      // `text-max-width` + wrapping rather than shrinking it.
      width: 70,
      height: 36,
      padding: '10px',
      'text-wrap': 'wrap',
      'text-max-width': '140px',
      'border-width': 2,
    },
  },
  {
    selector: 'node[nodeType = "class"]',
    style: {
      shape: 'round-rectangle',
      'background-color': KG_NODE_COLORS.class.fill,
      'border-color': KG_NODE_COLORS.class.border,
      color: KG_NODE_COLORS.class.text,
    },
  },
  {
    selector: 'node[nodeType = "individual"]',
    style: {
      shape: 'ellipse',
      'background-color': KG_NODE_COLORS.individual.fill,
      'border-color': KG_NODE_COLORS.individual.border,
      color: KG_NODE_COLORS.individual.text,
    },
  },
  {
    selector: 'node[nodeType = "property"]',
    style: {
      shape: 'diamond',
      'background-color': KG_NODE_COLORS.property.fill,
      'border-color': KG_NODE_COLORS.property.border,
      color: KG_NODE_COLORS.property.text,
    },
  },
  {
    selector: 'node[nodeType = "literal"]',
    style: {
      shape: 'round-tag',
      'background-color': KG_NODE_COLORS.literal.fill,
      'border-color': KG_NODE_COLORS.literal.border,
      color: KG_NODE_COLORS.literal.text,
      'font-family': 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    },
  },
  {
    selector: 'node[nodeType = "blank"]',
    style: {
      shape: 'ellipse',
      'background-color': KG_NODE_COLORS.blank.fill,
      'border-color': KG_NODE_COLORS.blank.border,
      'border-style': 'dashed',
      color: KG_NODE_COLORS.blank.text,
      width: 40,
      height: 40,
    },
  },
  {
    selector: 'edge',
    style: {
      label: 'data(label)',
      'font-size': 10,
      'font-family': 'system-ui, -apple-system, Segoe UI, sans-serif',
      color: '#374151',
      'text-background-color': '#ffffff',
      'text-background-opacity': 0.9,
      'text-background-padding': '2px',
      width: 1.5,
      'line-color': '#6b7280',
      'target-arrow-color': '#6b7280',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
    },
  },
  {
    selector: ':selected',
    style: {
      'border-color': '#000000',
      'border-width': 3,
      'line-color': '#111827',
      'target-arrow-color': '#111827',
    },
  },
  // cytoscape-edgehandles transient styles
  {
    selector: '.eh-handle',
    style: {
      'background-color': '#2563eb',
      width: 14,
      height: 14,
      shape: 'ellipse',
      'overlay-opacity': 0,
      'border-width': 2,
      'border-color': '#ffffff',
    },
  },
  {
    selector: '.eh-hover',
    style: { 'background-color': '#1d4ed8' },
  },
  {
    selector: '.eh-source',
    style: {
      'border-color': '#2563eb',
      'border-width': 4,
      'border-style': 'solid',
    },
  },
  {
    selector: '.eh-target',
    style: {
      'border-color': '#16a34a',
      'border-width': 4,
      'border-style': 'solid',
    },
  },
  {
    selector: '.eh-preview, .eh-ghost-edge',
    style: {
      'line-color': '#2563eb',
      'target-arrow-color': '#2563eb',
      'source-arrow-color': '#2563eb',
    },
  },
];
