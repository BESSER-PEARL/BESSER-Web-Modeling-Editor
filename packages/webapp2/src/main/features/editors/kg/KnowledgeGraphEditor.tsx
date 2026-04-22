import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { KnowledgeGraphPalette } from './KnowledgeGraphPalette';
import { CytoscapeCanvas, CytoscapeCanvasHandle } from './CytoscapeCanvas';
import { KnowledgeGraphToolbar, ConnectMode } from './KnowledgeGraphToolbar';
import { KnowledgeGraphInspector, KgSelection } from './KnowledgeGraphInspector';
import { KnowledgeGraphNodeList } from './KnowledgeGraphNodeList';
import { useProject } from '../../../app/hooks/useProject';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import {
  getActiveDiagram,
  getKgHardLimit,
  getKgLayout,
  getKgSoftLimit,
  isKnowledgeGraphData,
} from '../../../shared/types/project';
import type { KnowledgeGraphData } from './types';

const EMPTY_KG: KnowledgeGraphData = {
  type: 'KnowledgeGraphDiagram',
  version: '1.0.0',
  nodes: [],
  edges: [],
};

/** Pick the initial visibleIds for a freshly-loaded model. Prefers the
 *  persisted list (so selection survives remounts); otherwise seeds from
 *  the first soft-limit node ids and clamps to the hard limit. */
function seedVisibleIds(
  model: KnowledgeGraphData,
  softLimit: number,
  hardLimit: number,
): string[] {
  const modelIds = new Set(model.nodes.map((n) => n.id));
  const stored = model.settings?.visibleIds;
  if (Array.isArray(stored) && stored.length > 0) {
    // Filter out any stale ids (nodes removed from the model), then clamp.
    return stored.filter((id) => modelIds.has(id)).slice(0, hardLimit);
  }
  return model.nodes.slice(0, softLimit).map((n) => n.id).slice(0, hardLimit);
}

function arrayEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Top-level Knowledge Graph diagram editor.
 *  Layout: [palette + node list]  |  [toolbar + canvas]  |  [inspector]. */
export const KnowledgeGraphEditor: React.FC = () => {
  const { currentProject, currentDiagram } = useProject();
  const navigate = useNavigate();

  const loadFromStorage = useCallback((): KnowledgeGraphData => {
    try {
      const project = currentProject?.id
        ? ProjectStorageRepository.loadProject(currentProject.id)
        : ProjectStorageRepository.getCurrentProject();
      const diagram = project ? getActiveDiagram(project, 'KnowledgeGraphDiagram') : undefined;
      const model = diagram?.model;
      if (isKnowledgeGraphData(model)) {
        return model;
      }
    } catch (err) {
      console.error('[KnowledgeGraphEditor] Failed to load from storage', err);
    }
    return EMPTY_KG;
  }, [currentProject?.id]);

  const [model, setModel] = useState<KnowledgeGraphData>(() => loadFromStorage());
  const [selection, setSelection] = useState<KgSelection>(null);
  const [connectMode, setConnectMode] = useState<ConnectMode>('off');
  const canvasRef = useRef<CytoscapeCanvasHandle | null>(null);
  const modelRef = useRef(model);
  modelRef.current = model;

  const softLimit = getKgSoftLimit(model.settings);
  const hardLimit = getKgHardLimit(model.settings);
  const layout = getKgLayout(model.settings);
  const hardLimitRef = useRef(hardLimit);
  hardLimitRef.current = hardLimit;
  const prevLayoutRef = useRef(layout);

  // The set of node IDs currently visible on the canvas. Sticky: deleting
  // a visible node leaves the remaining visible IDs alone; changing the
  // soft-limit in settings re-seeds the set to the first N node ids.
  //
  // Persisted in `model.settings.visibleIds` so selection survives
  // navigation (e.g. leaving for KG Settings and coming back). We only
  // fall back to the soft-limit seed when no persisted list exists, which
  // matches the "soft limit only kicks in on fresh load" requirement.
  const [visibleIds, setVisibleIds] = useState<string[]>(() =>
    seedVisibleIds(model, softLimit, hardLimit),
  );
  const visibleIdsRef = useRef(visibleIds);
  visibleIdsRef.current = visibleIds;
  const prevSoftLimitRef = useRef<number>(softLimit);

  // Reseed visibleIds from the first `softLimit` ids ONLY when the user
  // actually changes the soft limit in KG Settings (not on normal
  // re-renders and not on initial mount). Hard-limit changes don't touch
  // the current visibility set — they just raise/lower the ceiling.
  useEffect(() => {
    if (prevSoftLimitRef.current === softLimit) return;
    prevSoftLimitRef.current = softLimit;
    const next = modelRef.current.nodes.slice(0, softLimit).map((n) => n.id);
    setVisibleIds(next.slice(0, hardLimit));
  }, [softLimit, hardLimit]);

  // Whenever the user picks a different layout algorithm in KG Settings,
  // trigger a fresh layout pass on the canvas. We skip the first run so
  // initial mount doesn't clobber persisted positions.
  useEffect(() => {
    if (prevLayoutRef.current === layout) return;
    prevLayoutRef.current = layout;
    canvasRef.current?.relayout();
  }, [layout]);

  const visibleNodeCount = useMemo(() => {
    const all = new Set(model.nodes.map((n) => n.id));
    return visibleIds.filter((id) => all.has(id)).length;
  }, [model.nodes, visibleIds]);
  const hiddenCount = Math.max(0, model.nodes.length - visibleNodeCount);

  // Reload when the active project / diagram index changes.
  useEffect(() => {
    const external = currentDiagram?.model;
    if (isKnowledgeGraphData(external)) {
      if (JSON.stringify(external) !== JSON.stringify(modelRef.current)) {
        setModel(external);
        setSelection(null);
        const soft = getKgSoftLimit(external.settings);
        const hard = getKgHardLimit(external.settings);
        prevSoftLimitRef.current = soft;
        setVisibleIds(seedVisibleIds(external, soft, hard));
      }
      return;
    }
    const fresh = loadFromStorage();
    setModel(fresh);
    setSelection(null);
    const soft = getKgSoftLimit(fresh.settings);
    const hard = getKgHardLimit(fresh.settings);
    prevSoftLimitRef.current = soft;
    setVisibleIds(seedVisibleIds(fresh, soft, hard));
  }, [currentProject?.id, currentDiagram, loadFromStorage]);

  // One debounced save pipeline for BOTH model (nodes/edges/settings) and
  // the visible-id selection, so the user's selection survives remounts.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSave = useCallback(() => {
    if (!currentProject?.id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const project = ProjectStorageRepository.loadProject(currentProject.id);
      if (!project) return;
      const active = getActiveDiagram(project, 'KnowledgeGraphDiagram');
      if (!active) return;
      const nextModel: KnowledgeGraphData = {
        ...modelRef.current,
        settings: {
          ...modelRef.current.settings,
          visibleIds: visibleIdsRef.current,
        },
      };
      ProjectStorageRepository.updateDiagram(currentProject.id, 'KnowledgeGraphDiagram', {
        ...active,
        model: nextModel,
        lastUpdate: new Date().toISOString(),
      });
    }, 400);
  }, [currentProject?.id]);

  const handleChange = useCallback((next: KnowledgeGraphData) => {
    // Compute the new visibleIds list and any overflow BEFORE we call setState,
    // so the toast fires exactly once (React may re-execute setState updaters
    // in StrictMode, which would double-fire a toast placed inside the setter).
    const prevVisible = visibleIdsRef.current;
    const prevVisibleSet = new Set(prevVisible);
    const nextIds = new Set(next.nodes.map((n) => n.id));
    const priorIds = new Set(modelRef.current.nodes.map((n) => n.id));

    // Drop visible ids that no longer exist in the model (delete path).
    const pruned = prevVisible.filter((id) => nextIds.has(id));

    // Append ids for nodes that just appeared (palette drop, future batch add).
    // The filter / query in the node list has no bearing here — newly-created
    // nodes always attempt to become visible, independent of what's filtered
    // in the list panel.
    const newlyCreated: string[] = [];
    for (const n of next.nodes) {
      if (!priorIds.has(n.id) && !prevVisibleSet.has(n.id)) newlyCreated.push(n.id);
    }

    const hardLimit = hardLimitRef.current;
    const room = Math.max(0, hardLimit - pruned.length);
    const fitting = newlyCreated.length <= room ? newlyCreated : newlyCreated.slice(0, room);
    const notShown = newlyCreated.length - fitting.length;

    if (notShown > 0) {
      if (newlyCreated.length === 1) {
        toast.error(
          `Node created, but could not be displayed because the hard limit of ` +
            `${hardLimit} is reached. Hide some nodes in the list or raise the ` +
            `hard limit in KG Settings.`,
        );
      } else {
        toast.error(
          `${newlyCreated.length} nodes created; ${notShown} could not be displayed ` +
            `because the hard limit of ${hardLimit} is reached. Hide some nodes in ` +
            `the list or raise the hard limit in KG Settings.`,
        );
      }
    }

    const nextVisibleIds = fitting.length > 0 ? [...pruned, ...fitting] : pruned;
    // Only emit a new reference if contents actually changed, to avoid an
    // unnecessary canvas resync when only node positions moved.
    const sameVisible =
      nextVisibleIds.length === prevVisible.length &&
      nextVisibleIds.every((id, i) => id === prevVisible[i]);
    if (!sameVisible) setVisibleIds(nextVisibleIds);
    setModel(next);
    scheduleSave();
  }, [scheduleSave]);

  // Whenever visibleIds changes on its own (toggle/bulk from the node list),
  // schedule the same unified save so the selection is persisted.
  useEffect(() => {
    scheduleSave();
  }, [visibleIds, scheduleSave]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
    };
  }, []);

  const toggleNodeVisibility = useCallback(
    (id: string, shouldBeVisible: boolean) => {
      setVisibleIds((prev) => {
        const has = prev.includes(id);
        if (shouldBeVisible && !has) {
          if (prev.length >= hardLimitRef.current) {
            toast.error(
              `Cannot visualize more than ${hardLimitRef.current} nodes at once. ` +
                `Uncheck some in the node list or raise the hard limit in KG Settings.`,
            );
            return prev;
          }
          return [...prev, id];
        }
        if (!shouldBeVisible && has) {
          return prev.filter((x) => x !== id);
        }
        return prev;
      });
    },
    [],
  );

  const bulkToggleVisibility = useCallback(
    (ids: string[], shouldBeVisible: boolean) => {
      setVisibleIds((prev) => {
        const prevSet = new Set(prev);
        if (!shouldBeVisible) {
          const drop = new Set(ids);
          return prev.filter((id) => !drop.has(id));
        }
        // Adding in bulk: only add ids that aren't already visible, and stop
        // at the hard limit. If we can't fit them all, toast once.
        const toAdd = ids.filter((id) => !prevSet.has(id));
        if (toAdd.length === 0) return prev;
        const room = Math.max(0, hardLimitRef.current - prev.length);
        if (toAdd.length > room) {
          toast.error(
            `Cannot visualize more than ${hardLimitRef.current} nodes at once. ` +
              `Only ${room} of the ${toAdd.length} newly-selected nodes were added. ` +
              `Uncheck some in the node list or raise the hard limit in KG Settings.`,
          );
          return [...prev, ...toAdd.slice(0, room)];
        }
        return [...prev, ...toAdd];
      });
    },
    [],
  );

  const emptyState = useMemo(() => model.nodes.length === 0 && model.edges.length === 0, [model]);
  const handleOpenSettings = () => navigate('/kg-settings');

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="flex h-full w-64 shrink-0 flex-col overflow-hidden border-r border-border/60 bg-muted/20">
        <KnowledgeGraphPalette />
        <KnowledgeGraphNodeList
          model={model}
          visibleIds={visibleIds}
          onToggle={toggleNodeVisibility}
          onBulkToggle={bulkToggleVisibility}
        />
      </div>
      <div className="flex flex-1 flex-col">
        <KnowledgeGraphToolbar
          connectMode={connectMode}
          onConnectModeChange={setConnectMode}
          onFit={() => canvasRef.current?.fit()}
          onResetLayout={() => canvasRef.current?.relayout()}
          nodeCount={model.nodes.length}
          edgeCount={model.edges.length}
          hiddenCount={hiddenCount}
          onOpenSettings={handleOpenSettings}
        />
        <div className="relative flex-1">
          <CytoscapeCanvas
            ref={canvasRef}
            model={model}
            visibleIds={visibleIds}
            layout={layout}
            connectMode={connectMode}
            onChange={handleChange}
            onSelect={setSelection}
            onExitConnectMode={() => setConnectMode('off')}
            onRevealNodes={(ids) => bulkToggleVisibility(ids, true)}
          />
          {emptyState && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="rounded-lg border border-dashed border-border/60 bg-background/70 px-4 py-3 text-sm text-muted-foreground backdrop-blur">
                Drag a node kind from the palette onto the canvas, or use File → Import KG to load an OWL ontology.
              </div>
            </div>
          )}
          {!emptyState && hiddenCount > 0 && (
            <div className="pointer-events-none absolute left-2 top-2 rounded-md border border-amber-400/60 bg-amber-50 px-2 py-1 text-xs text-amber-900 shadow-sm dark:bg-amber-900/30 dark:text-amber-100">
              Showing {visibleNodeCount} of {model.nodes.length} nodes (soft: {softLimit}, hard: {hardLimit})
            </div>
          )}
        </div>
      </div>
      <KnowledgeGraphInspector
        model={model}
        selection={selection}
        onChange={handleChange}
        onClearSelection={() => {
          setSelection(null);
          canvasRef.current?.clearSelection();
        }}
      />
    </div>
  );
};
