import { beforeAll, describe, expect, it } from 'vitest';
import { UMLDiagramType } from '@besser/wme';
import type { UMLElement, UMLModel, UMLRelationship } from '@besser/wme';
import { relationshipMidpoint } from '../../../../../../editor/src/main/packages/common/relationship-label/relationship-midpoint';
import { bpmnModelToComponentModel } from '../bpmn-to-component';
import { renderInEditor } from './render-in-editor';
import agenticStarter from '../../../templates/pattern/bpmn/agentic_starter.json';
import divergeMerge from './fixtures/diverge-merge.json';
import gatewayRouted from './fixtures/gateway-routed.json';
import minimalAgentic from './fixtures/minimal-agentic.json';
import multiPoolMessage from './fixtures/multi-pool-message.json';
import poolMessage from './fixtures/pool-message.json';

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

type Box = { x: number; y: number; width: number; height: number };

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
function laneComponentsBySubsystem(model: UMLModel): Map<UMLElement, UMLElement[]> {
  const out = new Map<UMLElement, UMLElement[]>();
  for (const el of Object.values(model.elements)) {
    if (el.type !== 'Component' || !el.owner) continue;
    const sub = model.elements[el.owner];
    if (sub?.type !== 'Subsystem') continue;
    out.set(sub, [...(out.get(sub) ?? []), el]);
  }
  return out;
}

/**
 * Box of a dependency's «stereotype» label as the editor draws it: anchored at
 * the path midpoint, centred above a horizontal segment or right of a vertical
 * one, at 85 % of the bold 16 px font (~8.5 px per glyph, 12 px tall).
 */
function labelBox(rel: UMLRelationship & { stereotype?: string }): Box {
  const path = rel.path.map((p) => ({ x: rel.bounds.x + p.x, y: rel.bounds.y + p.y }));
  const { position, direction } = relationshipMidpoint(path);
  const width = `«${rel.stereotype}»`.length * 8.5;
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
      const content: Box = {
        x: sub.bounds.x,
        y: sub.bounds.y + HEADER_HEIGHT,
        width: sub.bounds.width,
        height: sub.bounds.height - HEADER_HEIGHT,
      };
      for (const c of comps)
        expect(contains(content, c.bounds), `${c.name} below the header of ${sub.name}`).toBe(true);
      for (let i = 0; i < comps.length; i++) {
        for (let j = i + 1; j < comps.length; j++) {
          const grown = {
            ...comps[i].bounds,
            x: comps[i].bounds.x - MIN_GAP,
            width: comps[i].bounds.width + 2 * MIN_GAP,
          };
          expect(intersects(grown, comps[j].bounds), `${comps[i].name} ↔ ${comps[j].name}`).toBe(false);
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
      for (const rel of Object.values(rendered.relationships)) {
        if (rel.type !== 'ComponentDependency') continue;
        const src = rendered.elements[rel.source.element];
        const tgt = rendered.elements[rel.target.element];
        if (src?.type !== 'Component' || tgt?.type !== 'Component' || src.owner !== tgt.owner || !src.owner) continue;
        const sub = rendered.elements[src.owner];
        const comps = Object.values(rendered.elements).filter((c) => c.type === 'Component' && c.owner === sub.id);
        const header: Box = { ...sub.bounds, height: HEADER_HEIGHT };
        const label = labelBox(rel);
        const what = `«${(rel as { stereotype?: string }).stereotype}» ${src.name} → ${tgt.name}`;

        expect(intersects(label, header), `${what}: label on the header`).toBe(false);
        for (const c of comps) expect(intersects(label, c.bounds), `${what}: label on ${c.name}`).toBe(false);
        expect(contains(sub.bounds, label), `${what}: label inside ${sub.name}`).toBe(true);
        for (const p of rel.path) {
          expect(rel.bounds.y + p.y, `${what}: path through the header`).toBeGreaterThanOrEqual(
            sub.bounds.y + HEADER_HEIGHT,
          );
        }
        checked++;
      }
      if (source === agenticStarter) expect(checked).toBe(2); // «revises» and «supervises»
    },
  );
});
