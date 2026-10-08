import { beforeAll, describe, expect, it } from 'vitest';
import { UMLDiagramType, type BesserEdge, type BesserNode, type UMLModel } from '@besser/wme';
import { bpmnModelToComponentModel } from '../bpmn-to-component';
import { drawnRoute, renderInEditor } from './render-in-editor';
import { absBox, nameOf, nodeById, type Box } from './v4-helpers';
import agenticStarterTemplate from '../../../templates/pattern/bpmn/agentic_starter.json';
import divergeMerge from './fixtures/diverge-merge.json';
import gatewayRouted from './fixtures/gateway-routed.json';
import minimalAgentic from './fixtures/minimal-agentic.json';
import multiPoolMessage from './fixtures/multi-pool-message.json';
import poolMessage from './fixtures/pool-message.json';

const agenticStarter = agenticStarterTemplate as unknown as UMLModel;

// Layout of the derived Component diagram: lane Components sit apart, inside
// their Subsystem and below its header, and the «stereotype» labels of the
// agent → agent dependencies land clear of the Components and the header.

const SOURCES: Record<string, unknown> = {
  'agentic_starter template': agenticStarter,
  'diverge-merge': divergeMerge,
  'gateway-routed': gatewayRouted,
  'minimal-agentic': minimalAgentic,
  'multi-pool-message': multiPoolMessage,
  'pool-message': poolMessage,
};

/** Subsystem header: «subsystem» stereotype and the name, drawn in the top ~45 px. */
const HEADER_HEIGHT = 50;
const MIN_GAP = 120;

type Point = { x: number; y: number };

const intersects = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const contains = (outer: Box, inner: Box): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

function derive(source: unknown): UMLModel {
  const r = bpmnModelToComponentModel(source as UMLModel);
  if (!r.ok) throw new Error(`derivation refused: ${r.reason}`);
  return r.model;
}

/** Agent Components (the lane Components) grouped by their Subsystem. */
function laneComponentsBySubsystem(model: UMLModel): Map<BesserNode, BesserNode[]> {
  const out = new Map<BesserNode, BesserNode[]>();
  for (const node of model.nodes) {
    if (node.type !== 'component' || !node.parentId) continue;
    const sub = nodeById(model, node.parentId);
    if (sub?.type !== 'componentSubsystem') continue;
    out.set(sub, [...(out.get(sub) ?? []), node]);
  }
  return out;
}

/** Point halfway along a polyline, and whether its segment there is horizontal. */
function polylineMidpoint(path: Point[]): { position: Point; direction: 'h' | 'v' } {
  const segments = path.slice(1).map((p, i) => ({ from: path[i], dx: p.x - path[i].x, dy: p.y - path[i].y }));
  let remaining = segments.reduce((sum, s) => sum + Math.hypot(s.dx, s.dy), 0) / 2;
  for (const { from, dx, dy } of segments) {
    const length = Math.hypot(dx, dy);
    if (length > remaining) {
      return {
        position: { x: from.x + (dx / length) * remaining, y: from.y + (dy / length) * remaining },
        direction: Math.abs(dx) > Math.abs(dy) ? 'h' : 'v',
      };
    }
    remaining -= length;
  }
  return { position: { x: 0, y: 0 }, direction: 'v' };
}

/**
 * Box of a dependency's «stereotype» label as the editor draws it: anchored at
 * the midpoint of the drawn route, centred above a horizontal segment or right
 * of a vertical one, at 85 % of the bold 16 px font (~8.5 px per glyph, 12 px tall).
 */
function labelBox(model: UMLModel, edge: BesserEdge): Box {
  const { position, direction } = polylineMidpoint(drawnRoute(model, edge));
  const width = `«${String(edge.data.stereotype)}»`.length * 8.5;
  const height = 12;
  return direction === 'h'
    ? { x: position.x - width / 2, y: position.y - 5 - height, width, height }
    : { x: position.x + 5, y: position.y - height / 2, width, height };
}

describe('bpmnModelToComponentModel layout', () => {
  it.each(Object.entries(SOURCES))('keeps the lane Components apart and inside their Subsystem: %s', (_, source) => {
    const model = derive(source);
    const groups = laneComponentsBySubsystem(model);
    expect(groups.size).toBeGreaterThan(0);
    for (const [sub, comps] of groups) {
      const subBox = absBox(model, sub);
      const content: Box = {
        x: subBox.x,
        y: subBox.y + HEADER_HEIGHT,
        width: subBox.width,
        height: subBox.height - HEADER_HEIGHT,
      };
      const boxes = comps.map((c) => absBox(model, c));
      comps.forEach((c, i) =>
        expect(contains(content, boxes[i]), `${nameOf(c)} below the header of ${nameOf(sub)}`).toBe(true),
      );
      for (let i = 0; i < comps.length; i++) {
        for (let j = i + 1; j < comps.length; j++) {
          const grown = { ...boxes[i], x: boxes[i].x - MIN_GAP, width: boxes[i].width + 2 * MIN_GAP };
          expect(intersects(grown, boxes[j]), `${nameOf(comps[i])} ↔ ${nameOf(comps[j])}`).toBe(false);
        }
      }
    }
  });
});

describe('bpmnModelToComponentModel layout, rendered by the Component editor', () => {
  beforeAll(() => {
    // jsdom has no SVG layout; measure text at 9 px per glyph. (Each test file
    // runs in its own environment, so the stub does not leak.)
    Object.defineProperty(SVGElement.prototype, 'getBBox', {
      configurable: true,
      value(this: SVGElement) {
        return { x: 0, y: 0, width: (this.textContent ?? '').length * 9, height: 16 };
      },
    });
  });

  it.each(Object.entries(SOURCES))(
    'routes agent → agent dependencies so their labels clear Components and the header: %s',
    async (_, source) => {
      const rendered = await renderInEditor(UMLDiagramType.ComponentDiagram, derive(source));
      let checked = 0;
      for (const edge of rendered.edges) {
        if (edge.type !== 'ComponentDependency') continue;
        const src = nodeById(rendered, edge.source);
        const tgt = nodeById(rendered, edge.target);
        if (src?.type !== 'component' || tgt?.type !== 'component' || src.parentId !== tgt.parentId || !src.parentId)
          continue;
        const sub = nodeById(rendered, src.parentId)!;
        const subBox = absBox(rendered, sub);
        const comps = rendered.nodes.filter((c) => c.type === 'component' && c.parentId === sub.id);
        const header: Box = { ...subBox, height: HEADER_HEIGHT };
        const label = labelBox(rendered, edge);
        const what = `«${String(edge.data.stereotype)}» ${nameOf(src)} → ${nameOf(tgt)}`;

        expect(intersects(label, header), `${what}: label on the header`).toBe(false);
        for (const c of comps)
          expect(intersects(label, absBox(rendered, c)), `${what}: label on ${nameOf(c)}`).toBe(false);
        expect(contains(subBox, label), `${what}: label inside ${nameOf(sub)}`).toBe(true);
        for (const p of drawnRoute(rendered, edge)) {
          expect(p.y, `${what}: path through the header`).toBeGreaterThanOrEqual(subBox.y + HEADER_HEIGHT);
        }
        checked++;
      }
      if (source === agenticStarter) expect(checked).toBe(2); // «revises» and «supervises»
    },
  );
});
