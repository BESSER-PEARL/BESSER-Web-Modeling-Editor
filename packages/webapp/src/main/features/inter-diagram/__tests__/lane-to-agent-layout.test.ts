import { beforeAll, describe, expect, it } from 'vitest';
import { UMLDiagramType, type BesserNode, type UMLModel } from '@besser/wme';
import { laneToAgentModel } from '../lane-to-agent';
import { renderInEditor } from './render-in-editor';
import { absBox, nameOf, nodeById, nodeNamed, type Box } from './v4-helpers';
import agenticStarterTemplate from '../../../templates/pattern/bpmn/agentic_starter.json';
import divergeMerge from './fixtures/diverge-merge.json';
import flatNoPools from './fixtures/flat-no-pools.json';
import gatewayRouted from './fixtures/gateway-routed.json';
import minimalAgentic from './fixtures/minimal-agentic.json';
import multiPoolMessage from './fixtures/multi-pool-message.json';
import poolMessage from './fixtures/pool-message.json';
import singlePoolNoLanes from './fixtures/single-pool-no-lanes.json';

const agenticStarter = agenticStarterTemplate as unknown as UMLModel;

// Layout of the derived Agent diagram: no two on-canvas elements may overlap
// (or touch) — for every fixture, the agentic starter template, and every
// scaffold (self / human / cross reflection, governed merge, greeting).

const MIN_GAP = 40;

const SOURCES: Record<string, unknown> = {
  'agentic_starter template': agenticStarter,
  'diverge-merge': divergeMerge,
  'flat-no-pools': flatNoPools,
  'gateway-routed': gatewayRouted,
  'minimal-agentic': minimalAgentic,
  'multi-pool-message': multiPoolMessage,
  'pool-message': poolMessage,
  'single-pool-no-lanes': singlePoolNoLanes,
};

type Variant = 'as-is' | 'self' | 'human' | 'cross' | 'governed-merge';
const VARIANTS: Variant[] = ['as-is', 'self', 'human', 'cross', 'governed-merge'];

/** The source BPMN, with every task given a long name and the variant's scaffold. */
function variantOf(source: unknown, variant: Variant): UMLModel {
  const model = structuredClone(source) as UMLModel;
  const lanes = model.nodes.filter((n) => n.type === 'bpmnSwimlane');
  for (const node of model.nodes) {
    if (variant === 'as-is') continue;
    const data = node.data;
    if (node.type === 'bpmnTask') {
      data.name = `${nameOf(node)} with a deliberately long descriptive name`;
      if (variant === 'self' || variant === 'human' || variant === 'cross') data.reflectionMode = variant;
      if (variant === 'cross') data.reflectionReviewerLaneId = lanes.find((l) => l.id !== node.parentId)?.id;
    }
    if (variant === 'governed-merge' && node.type === 'bpmnGateway') {
      data.gatewayRole = 'merging';
      data.governanceDsl = 'Scopes: {}';
    }
  }
  return model;
}

/** The nodes the Agent editor draws on the canvas (intents live off-canvas). */
const canvasNodes = (model: UMLModel): BesserNode[] => model.nodes.filter((n) => n.type === 'AgentState');

function tooClose(a: Box, b: Box, gap: number): boolean {
  return (
    a.x < b.x + b.width + gap && b.x < a.x + a.width + gap && a.y < b.y + b.height + gap && b.y < a.y + a.height + gap
  );
}

function collisions(model: UMLModel, gap: number): string[] {
  const nodes = canvasNodes(model);
  const out: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (tooClose(absBox(model, nodes[i]), absBox(model, nodes[j]), gap))
        out.push(`${nameOf(nodes[i]) || nodes[i].type} ↔ ${nameOf(nodes[j]) || nodes[j].type}`);
    }
  }
  return out;
}

const derivations = Object.entries(SOURCES).flatMap(([sourceName, source]) =>
  VARIANTS.flatMap((variant) => {
    const bpmn = variantOf(source, variant);
    return bpmn.nodes
      .filter((n) => n.type === 'bpmnSwimlane' && n.data.isAgentic === true)
      .map((lane) => ({ label: `${sourceName} / ${variant} / lane ${nameOf(lane)}`, bpmn, laneId: lane.id }));
  }),
);

describe('laneToAgentModel layout', () => {
  it('covers every fixture with an agentic lane and every scaffold', () => {
    const sources = new Set(derivations.map((d) => d.label.split(' / ')[0]));
    expect(sources).toEqual(
      new Set([
        'agentic_starter template',
        'diverge-merge',
        'gateway-routed',
        'minimal-agentic',
        'multi-pool-message',
        'pool-message',
      ]),
    );
    const kinds = new Set<string>();
    for (const { bpmn, laneId } of derivations) {
      const r = laneToAgentModel(bpmn, laneId);
      if (!r.ok) continue;
      for (const n of canvasNodes(r.model)) {
        const name = nameOf(n);
        if (/_reflect$/.test(name)) kinds.add('self');
        if (/_human_review$/.test(name)) kinds.add('human');
        if (/^Address_merge_decision/.test(name)) kinds.add('merge');
        if (/_greet$/.test(name)) kinds.add('greet');
      }
    }
    expect(kinds).toEqual(new Set(['self', 'human', 'merge', 'greet']));
  });

  it.each(derivations)('keeps every state clear of the others: $label', ({ bpmn, laneId }) => {
    const r = laneToAgentModel(bpmn, laneId);
    if (!r.ok) throw new Error(`derivation refused: ${r.reason}`);
    expect(collisions(r.model, MIN_GAP)).toEqual([]);
  });

  it('sizes a state wide enough for its name, as the editor would', () => {
    const r = laneToAgentModel(variantOf(agenticStarter, 'self'), nodeNamed(agenticStarter, 'AgentReviewer')!.id);
    if (!r.ok) throw new Error('derivation refused');
    for (const s of canvasNodes(r.model)) {
      // 9 px per bold glyph is above the real average; the derived width must
      // still hold the name plus the editor's 60 px padding.
      expect(s.width).toBeGreaterThanOrEqual(Math.min(420, nameOf(s).length * 9 + 60));
    }
  });
});

describe('laneToAgentModel layout, rendered by the Agent editor', () => {
  beforeAll(() => {
    // jsdom has no SVG layout. Measure text at 9 px per bold glyph (8 px
    // otherwise), a realistic width for the editor's 16 px font. (Each test
    // file runs in its own environment, so the stub does not leak.)
    Object.defineProperty(SVGElement.prototype, 'getBBox', {
      configurable: true,
      value(this: SVGElement) {
        const text = this.textContent ?? '';
        const bold = this.style?.fontWeight === 'bold';
        return { x: 0, y: 0, width: text.length * (bold ? 9 : 8), height: 16 };
      },
    });
  });

  it('opens the AgentReviewer lane of the starter template without overlapping states', async () => {
    const bpmn = agenticStarter;
    const laneId = nodeNamed(bpmn, 'AgentReviewer')!.id;
    const r = laneToAgentModel(bpmn, laneId);
    if (!r.ok) throw new Error('derivation refused');

    const rendered = await renderInEditor(UMLDiagramType.AgentDiagram, r.model);
    const reflect = canvasNodes(rendered).find((n) => nameOf(n) === 'Check_bug_validity_reflect');
    expect(reflect).toBeDefined();
    expect(collisions(rendered, MIN_GAP)).toEqual([]);
    // The editor kept the derived widths, so the derived layout is what the user sees.
    for (const n of canvasNodes(rendered)) expect(n.width).toBe(nodeById(r.model, n.id)!.width);
    // The initial state is a flag on the state; it must survive the load.
    const initialState = (m: UMLModel) => m.nodes.find((n) => n.data.initial === true)?.id;
    expect(initialState(r.model)).toBeDefined();
    expect(initialState(rendered)).toBe(initialState(r.model));
  });
});
