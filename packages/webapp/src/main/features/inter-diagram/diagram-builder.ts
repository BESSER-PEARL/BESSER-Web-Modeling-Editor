import type { BesserEdge, BesserNode, UMLDiagramType, UMLModel } from '@besser/wme';
import { uuid } from '../../shared/utils/uuid';
import { recenterOnOrigin } from './recenter';

export type Box = { x: number; y: number; width: number; height: number };

/** Side of a node an edge leaves or enters by (a v4 handle id). */
export type Side = 'top' | 'right' | 'bottom' | 'left';

type Entry = { id: string; type: string; box: Box; data: Record<string, unknown>; parentId?: string };

/**
 * Collects the nodes and edges of a derived diagram. The derivations lay out in
 * absolute coordinates: a node keeps the `Box` it was added with (the caller
 * may still grow it), and `build()` converts each box to a position relative
 * to the node's parent. Edges carry no points, so the editor routes them from
 * their handles.
 */
export class DiagramBuilder {
  private readonly entries: Entry[] = [];
  private readonly byId = new Map<string, Entry>();
  readonly edges: BesserEdge[] = [];

  addNode(type: string, box: Box, data: Record<string, unknown>, parentId?: string): string {
    const entry: Entry = { id: uuid(), type, box, data, ...(parentId && { parentId }) };
    this.entries.push(entry);
    this.byId.set(entry.id, entry);
    return entry.id;
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  type(id: string): string | undefined {
    return this.byId.get(id)?.type;
  }

  /** Absolute box of a node. */
  box(id: string): Box {
    return this.byId.get(id)!.box;
  }

  data(id: string): Record<string, unknown> {
    return this.byId.get(id)!.data;
  }

  parentId(id: string): string | undefined {
    return this.byId.get(id)?.parentId;
  }

  nodeIds(type?: string): string[] {
    return this.entries.filter((e) => type === undefined || e.type === type).map((e) => e.id);
  }

  addEdge(
    type: string,
    source: string,
    target: string,
    [sourceHandle, targetHandle]: [Side, Side],
    data: Record<string, unknown> = {},
  ): string {
    const id = uuid();
    this.edges.push({
      id,
      source,
      target,
      type: type as BesserEdge['type'],
      sourceHandle,
      targetHandle,
      data: { ...data, points: [] },
    });
    return id;
  }

  removeEdge(id: string): void {
    const index = this.edges.findIndex((e) => e.id === id);
    if (index >= 0) this.edges.splice(index, 1);
  }

  /** Centre the nodes (and any `layoutOnly` boxes) on the origin. */
  recenter(layoutOnly: Box[] = []): void {
    recenterOnOrigin(
      this.entries.map((e) => e.box),
      layoutOnly,
    );
  }

  build(type: UMLDiagramType, extra: Partial<UMLModel> = {}): UMLModel {
    const nodes: BesserNode[] = this.entries.map(({ id, type: nodeType, box, data, parentId }) => {
      const parent = parentId ? this.byId.get(parentId)?.box : undefined;
      return {
        id,
        type: nodeType as BesserNode['type'],
        position: parent ? { x: box.x - parent.x, y: box.y - parent.y } : { x: box.x, y: box.y },
        width: box.width,
        height: box.height,
        measured: { width: box.width, height: box.height },
        data,
        ...(parentId && { parentId }),
      };
    });
    return {
      version: '4.0.0',
      id: uuid(),
      title: '',
      type,
      nodes,
      edges: this.edges,
      interactive: { elements: {}, relationships: {} },
      assessments: {},
      ...extra,
    };
  }
}

/** Node lookup over a v4 model, with the parent chain (`parentId`). */
export class ModelIndex {
  readonly byId: Map<string, BesserNode>;

  constructor(readonly model: UMLModel) {
    this.byId = new Map((model.nodes ?? []).map((n) => [n.id, n]));
  }

  get(id: string | undefined): BesserNode | undefined {
    return id === undefined ? undefined : this.byId.get(id);
  }

  /** The node's parent, when it has one that exists. */
  parent(node: BesserNode | undefined): BesserNode | undefined {
    return node?.parentId ? this.byId.get(node.parentId) : undefined;
  }

  /** Ancestors of a node, nearest first (cycle-safe). */
  ancestors(node: BesserNode | undefined): BesserNode[] {
    const chain: BesserNode[] = [];
    const seen = new Set<string>();
    for (let cur = this.parent(node); cur && !seen.has(cur.id); cur = this.parent(cur)) {
      seen.add(cur.id);
      chain.push(cur);
    }
    return chain;
  }

  nodes(type: string): BesserNode[] {
    return (this.model.nodes ?? []).filter((n) => n.type === type);
  }
}

/** `data.name` of a node, '' when unset. */
export const nodeName = (node: BesserNode | undefined): string => {
  const name = node?.data?.name;
  return typeof name === 'string' ? name : '';
};
