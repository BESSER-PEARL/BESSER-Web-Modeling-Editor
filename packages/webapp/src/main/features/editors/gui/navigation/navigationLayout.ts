import type { ElementDefinition } from 'cytoscape';
import { shellTargets, type NavigationGraph } from './navigationGraph';

/** Id of the single node that stands for the app shell's links. */
export const SHELL_NODE = '__shell__';
const COL = 250;
const ROW = 96;

const shorten = (text: string, max = 26) => (text.length > max ? text.slice(0, max - 1) + '…' : text);

/** Page cards in columns by clicks from the start page; unreached pages in a last column. */
export function toElements(graph: NavigationGraph, shellLabel: string, currentPageId?: string): ElementDefinition[] {
  const maxDepth = Math.max(0, ...graph.pages.map((p) => p.depth ?? 0));
  const columns = new Map<number, string[]>();
  const shell = shellTargets(graph);
  if (shell.length) columns.set(0, [SHELL_NODE]);
  graph.pages.forEach((p) => {
    const col = p.depth ?? maxDepth + 1;
    columns.set(col, [...(columns.get(col) ?? []), p.id]);
  });
  const position = new Map<string, { x: number; y: number }>();
  columns.forEach((ids, col) =>
    ids.forEach((id, row) => position.set(id, { x: col * COL, y: (row - (ids.length - 1) / 2) * ROW })),
  );

  const elements: ElementDefinition[] = graph.pages.map((p) => ({
    data: { id: p.id, label: `${shorten(p.name, 22)}\n${shorten(p.route, 24)}` },
    position: position.get(p.id),
    classes: [p.isStart && 'start', p.depth === null && 'unreached', p.id === currentPageId && 'current']
      .filter(Boolean)
      .join(' '),
  }));
  if (shell.length) {
    elements.push({ data: { id: SHELL_NODE, label: shellLabel }, position: position.get(SHELL_NODE), classes: 'shell' });
    shell.forEach((to) =>
      elements.push({ data: { id: `${SHELL_NODE}->${to}`, source: SHELL_NODE, target: to }, classes: 'shell' }),
    );
  }

  const byPair = new Map<string, { source: string; target: string; labels: Set<string> }>();
  graph.links.forEach((l) => {
    if (l.inShell || !l.toPageId || l.toPageId === l.fromPageId) return;
    const key = `${l.fromPageId}->${l.toPageId}`;
    const edge = byPair.get(key) ?? { source: l.fromPageId, target: l.toPageId, labels: new Set<string>() };
    edge.labels.add(l.label || l.target);
    byPair.set(key, edge);
  });
  byPair.forEach(({ source, target, labels }, id) => {
    elements.push({ data: { id, source, target, label: shorten([...labels].join(', ')) } });
  });
  return elements;
}
