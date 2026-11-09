import React, { useEffect, useMemo, useState } from 'react';
import cytoscape, { type ElementDefinition, type StylesheetJson } from 'cytoscape';
import type { Editor } from 'grapesjs';
import { AlertTriangle, ArrowRight, Unlink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useIsDarkTheme } from '../../../../shared/hooks/useIsDarkTheme';
import { buildNavigationGraph, type NavigationGraph } from './navigationGraph';

const SHELL_NODE = '__shell__';
const COL = 250;
const ROW = 96;

const shorten = (text: string, max = 26) => (text.length > max ? text.slice(0, max - 1) + '…' : text);

/** Page cards in columns by clicks from the start page; unreached pages in a last column. */
export function toElements(graph: NavigationGraph, shellLabel: string, currentPageId?: string): ElementDefinition[] {
  const maxDepth = Math.max(0, ...graph.pages.map((p) => p.depth ?? 0));
  const columns = new Map<number, string[]>();
  const shellTargets = [...new Set(graph.links.filter((l) => l.inShell && l.toPageId).map((l) => l.toPageId!))];
  if (shellTargets.length) columns.set(0, [SHELL_NODE]);
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
  if (shellTargets.length) {
    elements.push({ data: { id: SHELL_NODE, label: shellLabel }, position: position.get(SHELL_NODE), classes: 'shell' });
    shellTargets.forEach((to) => elements.push({ data: { id: `${SHELL_NODE}->${to}`, source: SHELL_NODE, target: to }, classes: 'shell' }));
  }

  const byPair = new Map<string, Set<string>>();
  graph.links.forEach((l) => {
    if (l.inShell || !l.toPageId || l.toPageId === l.fromPageId) return;
    const key = `${l.fromPageId}->${l.toPageId}`;
    byPair.set(key, (byPair.get(key) ?? new Set()).add(l.label || l.target));
  });
  byPair.forEach((labels, key) => {
    const [source, target] = key.split('->');
    elements.push({ data: { id: key, source, target, label: shorten([...labels].join(', ')) } });
  });
  return elements;
}

/** A theme colour token as a colour Cytoscape can parse (it ignores alpha in colours; use its *-opacity styles). */
const hsl = (name: string): string => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const [h, s, l] = raw.split(/\s+/);
  return h && s && l ? `hsl(${h}, ${s}, ${l})` : '#888';
};

function stylesheet(): StylesheetJson {
  const fg = hsl('--foreground');
  const muted = hsl('--muted-foreground');
  const brand = hsl('--brand');
  return [
    {
      selector: 'node',
      style: {
        shape: 'round-rectangle',
        width: 176,
        height: 52,
        label: 'data(label)',
        'text-wrap': 'wrap',
        'text-valign': 'center',
        'text-halign': 'center',
        'font-size': 12,
        'line-height': 1.35,
        'font-family': 'Inter, system-ui, -apple-system, Segoe UI, sans-serif',
        color: fg,
        'background-color': hsl('--card'),
        'border-width': 1.5,
        'border-color': hsl('--border'),
      },
    },
    { selector: 'node.start', style: { 'border-color': brand, 'border-width': 2.5 } },
    // The card stays opaque so edges do not show through; the tint is an underlay.
    { selector: 'node.current', style: { 'underlay-color': brand, 'underlay-opacity': 0.18, 'underlay-padding': 5, 'underlay-shape': 'round-rectangle' } },
    { selector: 'node.unreached', style: { 'border-style': 'dashed', 'border-color': hsl('--warning'), color: muted } },
    {
      selector: 'node.shell',
      style: { width: 150, height: 34, 'font-size': 11, color: muted, 'background-color': hsl('--background'), 'border-style': 'dotted', 'border-color': muted },
    },
    {
      selector: 'edge',
      style: {
        width: 1.5,
        'curve-style': 'bezier',
        'line-color': muted,
        'target-arrow-color': muted,
        'target-arrow-shape': 'triangle',
        'arrow-scale': 0.9,
        label: 'data(label)',
        'font-size': 10,
        color: fg,
        'text-background-color': hsl('--background'),
        'text-background-opacity': 1,
        'text-background-padding': '2px',
        'text-rotation': 'autorotate',
      },
    },
    { selector: 'edge.shell', style: { 'line-style': 'dashed', 'line-opacity': 0.55 } },
    { selector: 'node.hover', style: { 'border-color': brand } },
  ];
}

interface NavigationMapDialogProps {
  editor: Editor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Read-only map of the GUI's pages and the links between them. Clicking a page opens it. */
export const NavigationMapDialog: React.FC<NavigationMapDialogProps> = ({ editor, open, onOpenChange }) => {
  const { t } = useTranslation();
  const dark = useIsDarkTheme();
  // State, not a ref: the dialog content mounts after this component's effects run.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  const graph = useMemo(
    () => (open && editor ? buildNavigationGraph(editor.Pages.getAll() as any) : null),
    [open, editor],
  );
  const pageName = (id: string) => graph?.pages.find((p) => p.id === id)?.name ?? id;
  const shellTargets = graph ? [...new Set(graph.links.filter((l) => l.inShell && l.toPageId).map((l) => l.toPageId!))] : [];
  const unreached = graph?.pages.filter((p) => p.depth === null) ?? [];
  const broken = graph?.links.filter((l) => !l.toPageId) ?? [];
  const pageLinks = graph?.links.filter((l) => !l.inShell && l.toPageId && l.toPageId !== l.fromPageId) ?? [];

  const openPage = (pageId: string, componentId?: string) => {
    const page = editor?.Pages.get(pageId);
    if (!editor || !page) return;
    editor.Pages.select(page);
    if (componentId) {
      const comp = editor.Components.getById(componentId);
      if (comp) editor.select(comp);
    }
    onOpenChange(false);
  };

  useEffect(() => {
    if (!graph || !container) return;
    const cy = cytoscape({
      container,
      elements: toElements(graph, t('editors.gui.navigationMap.navBar'), editor?.Pages.getSelected()?.getId()),
      style: stylesheet(),
      layout: { name: 'preset' },
      autoungrabify: true,
      autounselectify: true,
      boxSelectionEnabled: false,
      minZoom: 0.3,
      maxZoom: 2,
    });
    const fit = () => {
      cy.resize();
      cy.fit(undefined, 40);
      if (cy.zoom() > 1.2) cy.zoom(1.2).center();
    };
    const frame = requestAnimationFrame(fit);
    cy.on('tap', 'node', (e) => {
      if (e.target.id() !== SHELL_NODE) openPage(e.target.id());
    });
    cy.on('mouseover', 'node', (e) => {
      if (e.target.id() === SHELL_NODE) return;
      e.target.addClass('hover');
      container.style.cursor = 'pointer';
    });
    cy.on('mouseout', 'node', (e) => {
      e.target.removeClass('hover');
      container.style.cursor = '';
    });
    return () => {
      cancelAnimationFrame(frame);
      cy.destroy();
    };
    // openPage only closes over editor/onOpenChange, which the graph already depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, dark, container]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t('editors.gui.navigationMap.title')}</DialogTitle>
          <DialogDescription>{t('editors.gui.navigationMap.description')}</DialogDescription>
        </DialogHeader>
        {graph && (
          <div className="grid min-h-0 gap-4 md:grid-cols-[minmax(0,1fr)_15rem]">
            <div
              ref={setContainer}
              role="img"
              aria-label={t('editors.gui.navigationMap.canvasLabel', { pages: graph.pages.length, links: pageLinks.length })}
              className="h-[60vh] min-h-[320px] rounded-lg border border-border bg-background"
            />
            <aside className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto text-sm">
              <p className="text-muted-foreground">
                {t('editors.gui.navigationMap.summary', { pages: graph.pages.length, links: pageLinks.length })}
              </p>

              {shellTargets.length > 0 && (
                <section>
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('editors.gui.navigationMap.navBar')}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {shellTargets.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => openPage(id)}
                        className="rounded-full border border-border px-2 py-0.5 text-xs hover:border-brand hover:text-brand"
                      >
                        {pageName(id)}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('editors.gui.navigationMap.attention')}
                </h3>
                {unreached.length === 0 && broken.length === 0 ? (
                  <p className="text-muted-foreground">{t('editors.gui.navigationMap.allGood')}</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {unreached.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => openPage(p.id)}
                          className="flex w-full items-start gap-2 rounded-md p-1.5 text-left hover:bg-muted"
                        >
                          <Unlink className="mt-0.5 size-3.5 shrink-0 text-warning" />
                          <span>{t('editors.gui.navigationMap.unreached', { page: p.name })}</span>
                        </button>
                      </li>
                    ))}
                    {broken.map((l) => (
                      <li key={l.componentId}>
                        <button
                          type="button"
                          onClick={() => openPage(l.fromPageId, l.componentId)}
                          className="flex w-full items-start gap-2 rounded-md p-1.5 text-left hover:bg-muted"
                        >
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                          <span>
                            {t('editors.gui.navigationMap.broken', {
                              label: l.label || l.target,
                              page: pageName(l.fromPageId),
                              target: l.target,
                            })}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <p className="mt-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                <ArrowRight className="size-3" />
                {t('editors.gui.navigationMap.hint')}
              </p>
            </aside>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
