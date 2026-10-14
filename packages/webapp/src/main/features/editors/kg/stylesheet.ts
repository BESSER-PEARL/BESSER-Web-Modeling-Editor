import type { StylesheetJson } from 'cytoscape';
import { KG_CONSTRAINT_TARGET_CLASS, KG_CONSTRAINT_TARGET_PROPERTY, KG_SH_PROPERTY } from './types';

/** Color per KG node type — palette swatches and canvas nodes stay in sync. */
export const KG_NODE_COLORS: Record<string, { fill: string; border: string; text: string }> = {
  class:              { fill: '#2563eb', border: '#1d4ed8', text: '#ffffff' },
  individual:         { fill: '#f97316', border: '#c2410c', text: '#1f2937' },
  property:           { fill: '#16a34a', border: '#15803d', text: '#ffffff' },
  literal:            { fill: '#facc15', border: '#ca8a04', text: '#1f2937' },
  blank:              { fill: '#9ca3af', border: '#4b5563', text: '#1f2937' },
  nodeConstraint:     { fill: '#a855f7', border: '#7e22ce', text: '#ffffff' },
  propertyConstraint: { fill: '#a855f7', border: '#7e22ce', text: '#ffffff' },
};

/** Predicate IRIs used internally to wire constraint nodes to their targets
 *  and to each other. Stylesheet selectors render these edges as dashed so
 *  they read as "constraint connection" rather than as domain edges. */
const KG_CONSTRAINT_EDGE_IRIS = [KG_CONSTRAINT_TARGET_CLASS, KG_CONSTRAINT_TARGET_PROPERTY, KG_SH_PROPERTY];

/** The colours that depend on the canvas background. Node fills carry their own
 *  text colour and read on either theme, so only edges, the selection
 *  highlight and the constraint-edge accent differ. */
interface ThemePalette {
  edgeText: string;
  edgeLabelBackground: string;
  edgeLine: string;
  selectedBorder: string;
  selectedLine: string;
  constraintEdge: string;
}

const LIGHT: ThemePalette = {
  edgeText: '#374151',
  edgeLabelBackground: '#ffffff',
  edgeLine: '#6b7280',
  selectedBorder: '#000000',
  selectedLine: '#111827',
  constraintEdge: KG_NODE_COLORS.nodeConstraint.border,
};

const DARK: ThemePalette = {
  edgeText: '#e5e7eb',
  edgeLabelBackground: '#0d1017', // the dark app background (themings.json)
  edgeLine: '#9ca3af',
  selectedBorder: '#ffffff',
  selectedLine: '#f9fafb',
  constraintEdge: '#c084fc',
};

/** The editor's Cytoscape stylesheet for the given theme. */
export function buildKgStylesheet(dark: boolean): StylesheetJson {
  const c = dark ? DARK : LIGHT;
  return [
  {
    selector: 'node',
    style: {
      // `displayLabel`, not `label`: `label` is the stored value and may be empty.
      label: 'data(displayLabel)',
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
    selector: 'node[nodeType = "nodeConstraint"]',
    style: {
      shape: 'round-rectangle',
      'background-color': KG_NODE_COLORS.nodeConstraint.fill,
      'border-color': KG_NODE_COLORS.nodeConstraint.border,
      color: KG_NODE_COLORS.nodeConstraint.text,
    },
  },
  {
    selector: 'node[nodeType = "propertyConstraint"]',
    style: {
      shape: 'diamond',
      'background-color': KG_NODE_COLORS.propertyConstraint.fill,
      'border-color': KG_NODE_COLORS.propertyConstraint.border,
      color: KG_NODE_COLORS.propertyConstraint.text,
    },
  },
  // Vocabulary nodes (owl:/rdf:/rdfs:/xsd:/sh:) keep their existing shape +
  // fill so the user still reads them as their declared kind (class,
  // individual, …), but get italic labels and a doubled purple border to
  // mark them as framework concepts rather than user-modelled domain
  // entities. The `Ⓥ` glyph appended by `displayLabel` provides the chip.
  {
    selector: 'node[?isVocab]',
    style: {
      'font-style': 'italic',
      'border-style': 'double',
      'border-color': '#7e22ce',
      'border-width': 3,
    },
  },
  // Internal constraint-wiring edges render as dashed lines so they don't
  // visually conflict with domain edges (rdfs:subClassOf, properties, etc.).
  ...KG_CONSTRAINT_EDGE_IRIS.map((iri) => ({
    selector: `edge[iri = "${iri}"]`,
    style: {
      'line-style': 'dashed',
      'line-color': c.constraintEdge,
      'target-arrow-color': c.constraintEdge,
      color: c.constraintEdge,
    },
  })),
  {
    selector: 'edge',
    style: {
      label: 'data(label)',
      'font-size': 10,
      'font-family': 'system-ui, -apple-system, Segoe UI, sans-serif',
      color: c.edgeText,
      'text-background-color': c.edgeLabelBackground,
      'text-background-opacity': 0.9,
      'text-background-padding': '2px',
      width: 1.5,
      'line-color': c.edgeLine,
      'target-arrow-color': c.edgeLine,
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
    },
  },
  {
    selector: ':selected',
    style: {
      'border-color': c.selectedBorder,
      'border-width': 3,
      'line-color': c.selectedLine,
      'target-arrow-color': c.selectedLine,
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
}

/** The light stylesheet. Exports (the standalone HTML has a white page) always
 *  use this one, whatever theme the editor is in. */
export const kgStylesheet: StylesheetJson = buildKgStylesheet(false);
