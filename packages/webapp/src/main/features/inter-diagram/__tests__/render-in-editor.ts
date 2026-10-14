import { act } from '@testing-library/react';
import { Position, getSmoothStepPath } from '@xyflow/react';
import { BesserEditor, parseSvgPath, removeDuplicatePoints, simplifySvgPath } from '@besser/wme';
import type { BesserEdge, UMLDiagramType, UMLModel } from '@besser/wme';
import { absBox, nodeById } from './v4-helpers';

type Point = { x: number; y: number };

/**
 * Load a derived `model` into a real BesserEditor (jsdom), as the derivation
 * hooks store it, and return the model the editor holds.
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
      editor = new BesserEditor(container, { type, model });
    });
    await editor!.nextRender;
    return editor!.model;
  } finally {
    act(() => editor?.destroy());
    container.remove();
  }
}

const POSITION: Record<string, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

function port(model: UMLModel, nodeId: string, handle: string): Point {
  const b = absBox(model, nodeById(model, nodeId)!);
  if (handle === 'top') return { x: b.x + b.width / 2, y: b.y };
  if (handle === 'bottom') return { x: b.x + b.width / 2, y: b.y + b.height };
  if (handle === 'left') return { x: b.x, y: b.y + b.height / 2 };
  return { x: b.x + b.width, y: b.y + b.height / 2 };
}

/**
 * Absolute route the editor draws for a derived edge (no stored points): the
 * step path between its two handles, as the step-path edges compute it.
 */
export function drawnRoute(model: UMLModel, edge: BesserEdge): Point[] {
  const source = port(model, edge.source, edge.sourceHandle);
  const target = port(model, edge.target, edge.targetHandle);
  const [path] = getSmoothStepPath({
    sourceX: source.x,
    sourceY: source.y,
    sourcePosition: POSITION[edge.sourceHandle] ?? Position.Right,
    targetX: target.x,
    targetY: target.y,
    targetPosition: POSITION[edge.targetHandle] ?? Position.Left,
    borderRadius: 0,
    offset: 30,
  });
  return removeDuplicatePoints(parseSvgPath(simplifySvgPath(path)));
}
