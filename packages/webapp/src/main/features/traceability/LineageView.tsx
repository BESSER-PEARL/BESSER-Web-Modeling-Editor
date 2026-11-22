import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { TraceIndex } from '../../shared/traceability/traceQueries';
import type { Lineage, LineageRow } from '../../shared/traceability/lineage';
import { expandableIds, lineageLayout, lineageOf, pathTo, runOfSubjectId } from '../../shared/traceability/lineage';
import { WHOLE_PROJECT } from './LineageRootPicker';
import { useToggleSet } from './components/toggleSet';
import { LineageGraph } from './lineage/LineageGraph';
import { LineageToolbar } from './lineage/LineageToolbar';
import type { LineageSelection } from './lineage/types';
import { EdgeDetail } from './lineage/details/EdgeDetail';
import { NodeDetail } from './lineage/details/NodeDetail';
import { OverviewDetail } from './lineage/details/OverviewDetail';
import { RunDetail } from './lineage/details/RunDetail';

interface LineageViewProps {
  index: TraceIndex;
  /** The whole project's lineage without history; the page computes it once and shares it. Computed here when left out. */
  projectLineage?: Lineage;
  /** The artifact the lineage starts from; the whole project when null. */
  rootId: string | null;
  onRootChange: (artifactId: string | null) => void;
  onOpenElement: (artifactId: string) => void;
}

/**
 * What was derived from what: diagrams, prompts and generated files as cards linked left to right.
 * Overview first; a card or row expands to show its parts that take part in links, and the model elements
 * the trace links nothing to, muted (see `lineage.ts`).
 */
export const LineageView: React.FC<LineageViewProps> = ({ index, projectLineage, rootId, onRootChange, onOpenElement }) => {
  const root = rootId && index.artifacts.has(rootId) ? rootId : null;
  const whole = useMemo(() => projectLineage ?? lineageOf(index, null, { history: false }), [projectLineage, index]);
  // Full screen and zoom are the view's: a new starting point keeps them.
  const [fullScreen, setFullScreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  // A new starting point starts collapsed again, with the path to it open.
  return (
    <LineageExplorer
      key={root ?? WHOLE_PROJECT}
      index={index}
      projectLineage={whole}
      root={root}
      onRootChange={onRootChange}
      onOpenElement={onOpenElement}
      fullScreen={fullScreen}
      setFullScreen={setFullScreen}
      zoom={zoom}
      setZoom={setZoom}
    />
  );
};

interface LineageExplorerProps {
  index: TraceIndex;
  projectLineage: Lineage;
  root: string | null;
  onRootChange: (artifactId: string | null) => void;
  onOpenElement: (artifactId: string) => void;
  fullScreen: boolean;
  setFullScreen: React.Dispatch<React.SetStateAction<boolean>>;
  zoom: number;
  setZoom: (zoom: number) => void;
}

const LineageExplorer: React.FC<LineageExplorerProps> = ({
  index, projectLineage, root, onRootChange, onOpenElement, fullScreen, setFullScreen, zoom, setZoom,
}) => {
  const { t } = useTranslation();
  const [history, setHistory] = useState(false);
  // The whole project's current lineage is the page's; only another start or the history is computed here.
  const lineage = useMemo(
    () => (root === null && !history ? projectLineage : lineageOf(index, root, { history })),
    [index, root, history, projectLineage],
  );
  const [expanded, toggle, setExpanded] = useToggleSet(() => new Set(root ? pathTo(index, root) : []));
  const layout = useMemo(() => lineageLayout(index, lineage, expanded), [index, lineage, expanded]);
  const [selection, setSelection] = useState<LineageSelection | null>(root ? { kind: 'node', id: root } : null);

  useEffect(() => {
    if (!fullScreen) return undefined;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setFullScreen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullScreen, setFullScreen]);

  const expand = (ids: string[]) => setExpanded((previous) => new Set([...previous, ...ids]));
  const selectNode = (row: LineageRow) => {
    setSelection({ kind: 'node', id: row.subject.id });
    if (row.parts > 0 && !row.expanded) expand([row.subject.id]);
  };
  const selectEdge = (id: string) => setSelection({ kind: 'edge', id });
  const selectNodeId = (id: string) => setSelection({ kind: 'node', id });
  const selectedEdge = selection?.kind === 'edge' ? lineage.edges.find((e) => e.link.id === selection.id) : undefined;
  const shown =
    selection &&
    (selection.kind === 'node' ? index.artifacts.has(selection.id) || runOfSubjectId(index, selection.id) !== undefined : selectedEdge !== undefined);
  const selected = shown ? selection : null;
  const selectedRun = selected?.kind === 'node' ? runOfSubjectId(index, selected.id) : undefined;

  if (lineage.edges.length === 0 && !root && !history) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t('traceability.lineage.empty')}</p>;
  }

  const explorer = (
    <div className={fullScreen ? 'fixed inset-0 z-50 flex flex-col gap-3 bg-background p-4' : 'space-y-3'}>
      <LineageToolbar
        index={index}
        projectLineage={projectLineage}
        root={root}
        onRootChange={onRootChange}
        history={history}
        onHistoryChange={setHistory}
        onExpandAll={() => setExpanded(expandableIds(index, lineage))}
        onCollapseAll={() => setExpanded(new Set())}
        zoom={zoom}
        onZoomChange={setZoom}
        fullScreen={fullScreen}
        onToggleFullScreen={() => setFullScreen((value) => !value)}
      />
      <div className={`grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] ${fullScreen ? 'min-h-0 flex-1' : 'h-[68vh] min-h-[440px]'}`}>
        <LineageGraph
          index={index}
          layout={layout}
          root={root}
          selected={selected}
          zoom={zoom}
          onSelectNode={selectNode}
          onSelectEdge={selectEdge}
          onToggle={toggle}
          onExpand={expand}
        />
        <div className="min-h-0 overflow-auto">
          {selected?.kind === 'edge' && selectedEdge ? (
            <EdgeDetail index={index} edge={selectedEdge} onSelectNode={selectNodeId} />
          ) : selectedRun ? (
            <RunDetail index={index} lineage={lineage} operation={selectedRun} onSelectNode={selectNodeId} />
          ) : selected ? (
            <NodeDetail
              index={index}
              lineage={lineage}
              artifact={index.artifacts.get(selected.id)!}
              isRoot={selected.id === root}
              onFocus={onRootChange}
              onOpenElement={onOpenElement}
              onSelectEdge={selectEdge}
            />
          ) : (
            <OverviewDetail index={index} lineage={lineage} layout={layout} onSelectEdge={selectEdge} />
          )}
        </div>
      </div>
    </div>
  );
  // Full screen leaves the page: inside it, the page's stacking context would keep it under the top bar.
  return fullScreen ? createPortal(explorer, document.body) : explorer;
};
