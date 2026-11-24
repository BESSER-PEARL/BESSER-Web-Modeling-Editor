import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronsDownUp, ChevronsUpDown, Maximize2, Minimize2, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { TraceIndex } from '../../../shared/traceability/traceQueries';
import type { Lineage } from '../../../shared/traceability/lineage';
import { LineageRootPicker } from '../LineageRootPicker';
import { Hint } from '../components/Hint';
import { EVIDENCE_STROKES, OUT_OF_DATE_STROKE } from './lineageLook';
import { ZOOM_LEVELS } from './types';

interface LineageToolbarProps {
  index: TraceIndex;
  projectLineage: Lineage;
  root: string | null;
  onRootChange: (artifactId: string | null) => void;
  history: boolean;
  onHistoryChange: (history: boolean) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  fullScreen: boolean;
  onToggleFullScreen: () => void;
}

/** The lineage's controls: where it starts, history, folding, zoom and full screen, and the legend. */
export const LineageToolbar: React.FC<LineageToolbarProps> = ({
  index, projectLineage, root, onRootChange, history, onHistoryChange, onExpandAll, onCollapseAll, zoom, onZoomChange,
  fullScreen, onToggleFullScreen,
}) => {
  const { t } = useTranslation();
  const zoomBy = (step: number) => {
    const at = ZOOM_LEVELS.indexOf(zoom);
    onZoomChange(ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, Math.max(0, at + step))]);
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <LineageRootPicker index={index} projectLineage={projectLineage} rootId={root} onChange={onRootChange} />
        <div className="flex items-center gap-2">
          <Checkbox id="lineage-history" checked={history} onCheckedChange={(checked) => onHistoryChange(checked === true)} />
          <Label htmlFor="lineage-history" className="text-xs font-normal">
            {t('traceability.lineage.history')}
          </Label>
          <Hint hint={t('traceability.lineage.historyHint')} />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={onExpandAll}>
            <ChevronsUpDown className="size-3.5" />
            {t('traceability.lineage.expandAll')}
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={onCollapseAll}>
            <ChevronsDownUp className="size-3.5" />
            {t('traceability.lineage.collapseAll')}
          </Button>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <Button size="icon" variant="outline" className="size-8" onClick={() => zoomBy(-1)} disabled={zoom === ZOOM_LEVELS[0]} aria-label={t('traceability.lineage.zoomOut')}>
            <ZoomOut className="size-4" />
          </Button>
          <button
            type="button"
            className="w-12 rounded text-center text-xs tabular-nums text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onZoomChange(1)}
            title={t('traceability.lineage.zoomReset')}
          >
            {Math.round(zoom * 100)}%
          </button>
          <Button size="icon" variant="outline" className="size-8" onClick={() => zoomBy(1)} disabled={zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]} aria-label={t('traceability.lineage.zoomIn')}>
            <ZoomIn className="size-4" />
          </Button>
          <Button size="sm" variant="outline" className="ml-1 h-8 gap-1" onClick={onToggleFullScreen}>
            {fullScreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            {t(fullScreen ? 'traceability.lineage.exitFullScreen' : 'traceability.lineage.fullScreen')}
          </Button>
        </div>
      </div>
      <LineageLegend />
    </div>
  );
};

/** What the connectors' strokes and marks mean, each entry explained by its tooltip. */
const LineageLegend: React.FC = () => {
  const { t } = useTranslation();
  const line = (className: string, dashed = false) => (
    <svg width="22" height="8" aria-hidden className="shrink-0">
      <line x1="1" y1="4" x2="21" y2="4" strokeWidth="2.5" strokeDasharray={dashed ? '4 3' : undefined} className={className} />
    </svg>
  );
  const entry = (key: string, mark?: React.ReactNode) => (
    <Hint hint={t(`traceability.lineage.legendHints.${key}`)} className="flex items-center gap-1 underline decoration-dotted underline-offset-2">
      {mark}
      {t(`traceability.lineage.legend.${key}`)}
    </Hint>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {entry('rule', line(EVIDENCE_STROKES.RuleEvidence))}
      {entry('aiLabelled', line(EVIDENCE_STROKES.AIEvidence))}
      {entry('outOfDate', <>{line(OUT_OF_DATE_STROKE)}<AlertTriangle className="size-3 text-warning" aria-hidden /></>)}
      {entry('upstreamChanged', line(OUT_OF_DATE_STROKE, true))}
      {entry('width')}
    </div>
  );
};
