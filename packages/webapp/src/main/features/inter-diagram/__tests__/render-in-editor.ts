import { act } from '@testing-library/react';
import { Position, getSmoothStepPath } from '@xyflow/react';
import { BesserEditor, parseSvgPath, removeDuplicatePoints, simplifySvgPath } from '@besser/wme';
import type { UMLDiagramType } from '@besser/wme';
import {
  Direction,
  derivedToV4,
  toLegacyV3,
  type IPoint,
  type UMLModel,
  type UMLRelationship,
} from '../legacyV3Bridge';

/**
 * Load the derived (v3) `model` into a real BesserEditor (jsdom), stored the
 * way the derivation hooks store it (v4, edges without points), and return the
 * model the editor holds, back in the v3 shape.
 *
 * jsdom has no SVG layout: the caller stubs `SVGElement.prototype.getBBox`.
 */
export async function renderInEditor(type: UMLDiagramType, model: UMLModel): Promise<UMLModel> {
  // React Flow observes node sizes; jsdom has no ResizeObserver.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  const container = document.createElement('div');
  document.body.appendChild(container);
  let editor: BesserEditor | undefined;
  try {
    act(() => {
      editor = new BesserEditor(container, { type, model: derivedToV4(model) });
    });
    await editor!.nextRender;
    return toLegacyV3(editor!.model);
  } finally {
    act(() => editor?.destroy());
    container.remove();
  }
}

const POSITION: Partial<Record<Direction, Position>> = {
  [Direction.Up]: Position.Top,
  [Direction.Right]: Position.Right,
  [Direction.Down]: Position.Bottom,
  [Direction.Left]: Position.Left,
};

function port(model: UMLModel, end: UMLRelationship['source']): IPoint {
  const b = model.elements[end.element].bounds;
  if (end.direction === Direction.Up) return { x: b.x + b.width / 2, y: b.y };
  if (end.direction === Direction.Down) return { x: b.x + b.width / 2, y: b.y + b.height };
  if (end.direction === Direction.Left) return { x: b.x, y: b.y + b.height / 2 };
  return { x: b.x + b.width, y: b.y + b.height / 2 };
}

/**
 * Absolute route the editor draws for a derived edge (no stored points): the
 * step path between its two ports, as the step-path edges compute it.
 */
export function drawnRoute(model: UMLModel, rel: UMLRelationship): IPoint[] {
  const source = port(model, rel.source);
  const target = port(model, rel.target);
  const [path] = getSmoothStepPath({
    sourceX: source.x,
    sourceY: source.y,
    sourcePosition: POSITION[rel.source.direction] ?? Position.Right,
    targetX: target.x,
    targetY: target.y,
    targetPosition: POSITION[rel.target.direction] ?? Position.Left,
    borderRadius: 0,
    offset: 30,
  });
  return removeDuplicatePoints(parseSvgPath(simplifySvgPath(path)));
}
