import { beforeAll, describe, expect, it } from 'vitest';
import { UMLDiagramType } from '@besser/wme';
import type { UMLElement, UMLModel } from '@besser/wme';
import { laneToAgentModel } from '../lane-to-agent';
import { renderInEditor } from './render-in-editor';
import agenticStarter from '../../../templates/pattern/bpmn/agentic_starter.json';
import divergeMerge from './fixtures/diverge-merge.json';
import flatNoPools from './fixtures/flat-no-pools.json';
import gatewayRouted from './fixtures/gateway-routed.json';
import minimalAgentic from './fixtures/minimal-agentic.json';
import multiPoolMessage from './fixtures/multi-pool-message.json';
import poolMessage from './fixtures/pool-message.json';
import singlePoolNoLanes from './fixtures/single-pool-no-lanes.json';

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
  const lanes = Object.values(model.elements).filter((e) => e.type === 'BPMNSwimlane');
  for (const el of Object.values(model.elements) as Array<UMLElement & Record<string, unknown>>) {
    if (variant === 'as-is') continue;
    if (el.type === 'BPMNTask') {
      el.name = `${el.name} with a deliberately long descriptive name`;
      if (variant === 'self' || variant === 'human' || variant === 'cross') el.reflectionMode = variant;
      if (variant === 'cross') el.reflectionReviewerLaneId = lanes.find((l) => l.id !== el.owner)?.id;
    }
    if (variant === 'governed-merge' && el.type === 'BPMNGateway') {
      el.gatewayRole = 'merging';
      el.governanceDsl = 'Scopes: {}';
    }
  }
  return model;
}

/** The elements the Agent editor draws on the canvas (intents live off-canvas). */
const canvasElements = (model: UMLModel): UMLElement[] =>
  Object.values(model.elements).filter((e) => e.type === 'AgentState' || e.type === 'StateInitialNode');

function tooClose(a: UMLElement['bounds'], b: UMLElement['bounds'], gap: number): boolean {
  return (
    a.x < b.x + b.width + gap && b.x < a.x + a.width + gap && a.y < b.y + b.height + gap && b.y < a.y + a.height + gap
  );
}

function collisions(model: UMLModel, gap: number): string[] {
  const els = canvasElements(model);
  const out: string[] = [];
  for (let i = 0; i < els.length; i++) {
    for (let j = i + 1; j < els.length; j++) {
      if (tooClose(els[i].bounds, els[j].bounds, gap))
        out.push(`${els[i].name || els[i].type} ↔ ${els[j].name || els[j].type}`);
    }
  }
  return out;
}

const derivations = Object.entries(SOURCES).flatMap(([sourceName, source]) =>
  VARIANTS.flatMap((variant) => {
    const bpmn = variantOf(source, variant);
    return Object.values(bpmn.elements)
      .filter((e) => e.type === 'BPMNSwimlane' && (e as { isAgentic?: boolean }).isAgentic === true)
      .map((lane) => ({ label: `${sourceName} / ${variant} / lane ${lane.name}`, bpmn, laneId: lane.id }));
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
      for (const e of canvasElements(r.model)) {
        if (/_reflect$/.test(e.name)) kinds.add('self');
        if (/_human_review$/.test(e.name)) kinds.add('human');
        if (/^Address_merge_decision/.test(e.name)) kinds.add('merge');
        if (/_greet$/.test(e.name)) kinds.add('greet');
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
    const r = laneToAgentModel(
      variantOf(agenticStarter, 'self'),
      Object.values(agenticStarter.elements).find((e) => e.name === 'AgentReviewer')!.id,
    );
    if (!r.ok) throw new Error('derivation refused');
    for (const s of canvasElements(r.model).filter((e) => e.type === 'AgentState')) {
      // 9 px per bold glyph is above the real average; the derived width must
      // still hold the name plus the editor's 60 px padding.
      expect(s.bounds.width).toBeGreaterThanOrEqual(Math.min(420, s.name.length * 9 + 60));
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
    const bpmn = agenticStarter as unknown as UMLModel;
    const laneId = Object.values(bpmn.elements).find((e) => e.name === 'AgentReviewer')!.id;
    const r = laneToAgentModel(bpmn, laneId);
    if (!r.ok) throw new Error('derivation refused');

    const rendered = await renderInEditor(UMLDiagramType.AgentDiagram, r.model);
    const reflect = canvasElements(rendered).find((e) => e.name === 'Check_bug_validity_reflect');
    expect(reflect).toBeDefined();
    expect(collisions(rendered, MIN_GAP)).toEqual([]);
    // The editor kept the derived widths, so the derived layout is what the user sees.
    for (const e of canvasElements(rendered)) expect(e.bounds.width).toBe(r.model.elements[e.id].bounds.width);
  });
});
