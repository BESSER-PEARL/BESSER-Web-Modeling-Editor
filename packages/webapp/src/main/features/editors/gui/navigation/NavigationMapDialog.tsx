import React, { useEffect, useMemo, useRef, useState } from 'react';
import cytoscape, { type Core, type StylesheetJson } from 'cytoscape';
import type { Editor } from 'grapesjs';
import { AlertTriangle, ArrowRight, Unlink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useIsDarkTheme } from '../../../../shared/hooks/useIsDarkTheme';
import { buildNavigationGraph, shellTargets } from './navigationGraph';
import { SHELL_NODE, toElements } from './navigationLayout';

/** Padding around the map when it is fitted to the canvas, as in the Knowledge Graph canvas. */
const FIT_PADDING = 40;
/** A small map is not blown up past this zoom when fitted. */
const MAX_FIT_ZOOM = 1.2;

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
        'font-family': 'system-ui, -apple-system, Segoe UI, sans-serif',
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
  const cyRef = useRef<Core | null>(null);

  const graph = useMemo(
    () => (open && editor ? buildNavigationGraph(editor.Pages.getAll()) : null),
    [open, editor],
  );
  const pageName = (id: string) => graph?.pages.find((p) => p.id === id)?.name ?? id;
  const shell = graph ? shellTargets(graph) : [];
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
      cy.fit(undefined, FIT_PADDING);
      if (cy.zoom() > MAX_FIT_ZOOM) cy.zoom(MAX_FIT_ZOOM).center();
    };
    cyRef.current = cy;
    const frame = requestAnimationFrame(fit);
    cy.on('tap', 'node', (e) => {
      if (e.target.id() !== SHELL_NODE) openPage(e.target.id());
    });
    cy.on('mouseover', 'node', (e) => {
      if (e.target.id() === SHELL_NODE) return;
      e.target.addClass('hover');
      container.classList.add('cursor-pointer');
    });
    cy.on('mouseout', 'node', (e) => {
      e.target.removeClass('hover');
      container.classList.remove('cursor-pointer');
    });
    return () => {
      cancelAnimationFrame(frame);
      cy.destroy();
      cyRef.current = null;
    };
    // The canvas is built once per opening: editor and onOpenChange (a state setter) do not change
    // while it is open, and a language switch remounts the editor. The theme is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, container]);

  useEffect(() => {
    cyRef.current?.style(stylesheet());
  }, [dark]);

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

              {shell.length > 0 && (
                <section>
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('editors.gui.navigationMap.navBar')}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {shell.map((id) => (
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
