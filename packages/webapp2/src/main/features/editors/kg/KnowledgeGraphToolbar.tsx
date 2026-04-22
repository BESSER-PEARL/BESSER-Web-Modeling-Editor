import React from 'react';
import { Link2, Maximize2, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** 'off' = move/select only; 'connect' = click-a-source-then-click-a-target. */
export type ConnectMode = 'off' | 'connect';

interface Props {
  connectMode: ConnectMode;
  onConnectModeChange: (mode: ConnectMode) => void;
  onFit: () => void;
  onResetLayout: () => void;
  nodeCount: number;
  edgeCount: number;
  hiddenCount: number;
  onOpenSettings?: () => void;
}

/** Top-of-canvas toolbar for the KG editor. An explicit "Add Relation" toggle
 *  plus Fit, and a status line that surfaces the visible-cap when it's active.
 *  Delete lives in the inspector side panel (click a node/edge to reveal). */
export const KnowledgeGraphToolbar: React.FC<Props> = ({
  connectMode,
  onConnectModeChange,
  onFit,
  onResetLayout,
  nodeCount,
  edgeCount,
  hiddenCount,
  onOpenSettings,
}) => {
  const isConnecting = connectMode === 'connect';
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 bg-muted/20 px-2 py-1.5">
      <div className="flex items-center gap-2">
        <Button
          variant={isConnecting ? 'default' : 'outline'}
          size="sm"
          className="h-7 gap-1.5 px-2"
          onClick={() => onConnectModeChange(isConnecting ? 'off' : 'connect')}
          title="Add a relation: click a source node, then click a target node"
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
          Click a source node, then click a target node to create a relation. Esc to cancel.
        </div>
      )}
    </div>
  );
};
