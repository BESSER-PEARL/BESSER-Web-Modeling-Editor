import React from 'react';
import { Download, Link2, Maximize2, RefreshCcw, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** 'off' = move/select only; 'connect' = drag-from-source-onto-target (node
 *  positions are frozen while this mode is on). */
export type ConnectMode = 'off' | 'connect';

interface Props {
  connectMode: ConnectMode;
  onConnectModeChange: (mode: ConnectMode) => void;
  onFit: () => void;
  onResetLayout: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
  nodeCount: number;
  edgeCount: number;
  hiddenCount: number;
  onOpenSettings?: () => void;
  onExportHtml?: () => void;
}

/** Top-of-canvas toolbar for the KG editor. An explicit "Add Relation" toggle
 *  plus Fit, and a status line that surfaces the visible-cap when it's active.
 *  Delete lives in the inspector side panel (click a node/edge to reveal). */
export const KnowledgeGraphToolbar: React.FC<Props> = ({
  connectMode,
  onConnectModeChange,
  onFit,
  onResetLayout,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  nodeCount,
  edgeCount,
  hiddenCount,
  onOpenSettings,
  onExportHtml,
}) => {
  const isConnecting = connectMode === 'connect';
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 bg-muted/20 px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={isConnecting ? 'default' : 'outline'}
          size="sm"
          className="h-7 gap-1.5 px-2"
          onClick={() => onConnectModeChange(isConnecting ? 'off' : 'connect')}
          title="Add a relation: drag from the source node to the target node"
          aria-pressed={isConnecting}
        >
          <Link2 className="size-3.5" />
          <span>{isConnecting ? 'Adding relation…' : 'Add relation'}</span>
        </Button>
        <div className="mx-1 h-5 w-px bg-border/60" />
        <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2" onClick={onFit} title="Fit to view">
          <Maximize2 className="size-3.5" />
          <span className="hidden md:inline">Fit</span>
        </Button>
        {onZoomIn && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-2"
            onClick={onZoomIn}
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn className="size-3.5" />
            <span className="hidden md:inline">Zoom in</span>
          </Button>
        )}
        {onZoomOut && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-2"
            onClick={onZoomOut}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut className="size-3.5" />
            <span className="hidden md:inline">Zoom out</span>
          </Button>
        )}
        {onResetZoom && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-2"
            onClick={onResetZoom}
            title="Reset zoom to 100% and re-centre the graph (right-click drag the canvas to pan)"
            aria-label="Reset zoom"
          >
            <RotateCcw className="size-3.5" />
            <span className="hidden md:inline">Reset zoom</span>
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 px-2"
          onClick={onResetLayout}
          title="Re-run the current layout on the visible nodes"
        >
          <RefreshCcw className="size-3.5" />
          <span className="hidden md:inline">Reset layout</span>
        </Button>
        {onExportHtml && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-2"
            onClick={onExportHtml}
            title="Download the current graph as a standalone interactive HTML file"
          >
            <Download className="size-3.5" />
            <span className="hidden md:inline">Export HTML</span>
          </Button>
        )}
        <div className="ml-auto text-xs text-muted-foreground">
          {hiddenCount > 0 ? (
            <>
              <span className="font-medium text-amber-600 dark:text-amber-400">
                Showing {nodeCount - hiddenCount} of {nodeCount} nodes
              </span>
              {onOpenSettings && (
                <>
                  {' — '}
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    raise the limit in KG Settings
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              {nodeCount} node{nodeCount === 1 ? '' : 's'} · {edgeCount} relation{edgeCount === 1 ? '' : 's'}
            </>
          )}
        </div>
      </div>
      {isConnecting && (
        <div className="text-[11px] text-muted-foreground">
          Drag from a source node onto a target node to create a relation. Node positions are locked
          while this mode is on — Esc to exit.
        </div>
      )}
    </div>
  );
};
