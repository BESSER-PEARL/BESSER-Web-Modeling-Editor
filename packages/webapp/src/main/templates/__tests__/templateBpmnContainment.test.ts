import { describe, expect, it } from 'vitest';

// Every bundled BPMN template must carry React Flow containment: a flow node /
// artifact drawn inside a pool is a (transitive) child of that pool — ideally
// of the lane it sits in — so dragging the pool moves its content. The
// smart-generator v3 originals had `owner: null` on all flow nodes; the
// library's `adoptBpmnContainment` (run by `normalizeV4Model`) repairs that
// and the shipped files were regenerated through it.
const templates = import.meta.glob('../pattern/**/*.json', { eager: true, import: 'default' }) as Record<string, any>;

const bpmnModels = (): Array<[string, any]> => {
  const out: Array<[string, any]> = [];
  for (const [path, json] of Object.entries(templates)) {
    if (json?.project) {
      for (const [bucket, list] of Object.entries(json.project.diagrams ?? {})) {
        (list as any[]).forEach((d, i) => {
          if (d?.model?.type === 'BPMNDiagram') out.push([`${path} ${bucket}[${i}]`, d.model]);
        });
      }
    } else if (json?.type === 'BPMNDiagram') {
      out.push([path, json]);
    }
  }
  return out;
};

type Rect = { x: number; y: number; width: number; height: number };

const absRect = (node: any, byId: Map<string, any>): Rect => {
  let x = node.position.x;
  let y = node.position.y;
  let parent = node.parentId ? byId.get(node.parentId) : undefined;
  while (parent) {
    x += parent.position.x;
    y += parent.position.y;
    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
  }
  return { x, y, width: node.width ?? 0, height: node.height ?? 0 };
};

const inside = (o: Rect, i: Rect) =>
  i.x >= o.x && i.y >= o.y && i.x + i.width <= o.x + o.width && i.y + i.height <= o.y + o.height;

const ancestors = (node: any, byId: Map<string, any>): string[] => {
  const out: string[] = [];
  let cur = node.parentId ? byId.get(node.parentId) : undefined;
  while (cur && !out.includes(cur.id)) {
    out.push(cur.id);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return out;
};

describe('bundled BPMN templates parent their pool content', () => {
  const models = bpmnModels();

  it('finds the BPMN templates that have pools', () => {
    const withPools = models.filter(([, m]) => m.nodes.some((n: any) => n.type === 'bpmnPool'));
    expect(withPools.map(([p]) => p).join(' ')).toMatch(/pizza_store\.json/);
    expect(withPools.map(([p]) => p).join(' ')).toMatch(/car_wash\.json/);
  });

  it.each(models)('%s', (_label, model) => {
    const nodes: any[] = model.nodes;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const index = new Map(nodes.map((n, i) => [n.id, i]));

    // React Flow requires parents to precede their children.
    for (const n of nodes) {
      if (n.parentId) {
        expect(byId.has(n.parentId), `${n.id} parent exists`).toBe(true);
        expect(index.get(n.parentId)! < index.get(n.id)!, `${n.id} after its parent`).toBe(true);
      }
    }

    const pools = nodes.filter((n) => n.type === 'bpmnPool');
    for (const n of nodes) {
      if (n.type === 'bpmnPool' || n.type === 'bpmnSwimlane') continue;
      const rect = absRect(n, byId);
      for (const pool of pools) {
        if (!inside(absRect(pool, byId), rect)) continue;
        const chain = ancestors(n, byId);
        expect(chain, `${n.id} is inside pool ${pool.id}`).toContain(pool.id);
        // In a laned pool the node belongs to a lane.
        const lanes = nodes.filter((l) => l.parentId === pool.id && l.type === 'bpmnSwimlane');
        if (lanes.length > 0) {
          expect(
            lanes.some((l) => chain.includes(l.id)),
            `${n.id} is in a lane of ${pool.id}`,
          ).toBe(true);
        }
      }
    }
  });
});
