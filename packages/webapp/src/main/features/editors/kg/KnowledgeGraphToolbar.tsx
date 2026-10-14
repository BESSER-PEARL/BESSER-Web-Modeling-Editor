import React from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Link2, Redo2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** 'off' = move/select only; 'connect' = drag-from-source-onto-target (node
 *  positions are frozen while this mode is on). */
export type ConnectMode = 'off' | 'connect';

interface Props {
  connectMode: ConnectMode;
  onConnectModeChange: (mode: ConnectMode) => void;
  nodeCount: number;
  edgeCount: number;
  hiddenCount: number;
  onOpenSettings?: () => void;
  onExportHtml?: () => void;
  /** History controls. Shown only when the host provides `onUndo`/`onRedo`. */
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

/** Top-of-canvas toolbar for the KG editor. An explicit "Add Relation" toggle
 *  plus export, and a status line that surfaces the visible-cap when it's
 *  active. Zoom, fit and reset-layout live in the floating controls at the
 *  bottom-right of the canvas (`KgCanvasControls`); delete lives in the
 *  inspector side panel (click a node/edge to reveal). */
export const KnowledgeGraphToolbar: React.FC<Props> = ({
  connectMode,
  onConnectModeChange,
  nodeCount,
  edgeCount,
  hiddenCount,
  onOpenSettings,
  onExportHtml,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}) => {
  const { t } = useTranslation();
  const isConnecting = connectMode === 'connect';
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 bg-muted/20 px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {(onUndo || onRedo) && (
          <>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 px-2"
                onClick={onUndo}
                disabled={!canUndo}
                title={t('editors.kg.toolbar.undoTooltip')}
              >
                <Undo2 className="size-3.5" />
                <span className="hidden md:inline">{t('editors.kg.toolbar.undo')}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 px-2"
                onClick={onRedo}
                disabled={!canRedo}
                title={t('editors.kg.toolbar.redoTooltip')}
              >
                <Redo2 className="size-3.5" />
                <span className="hidden md:inline">{t('editors.kg.toolbar.redo')}</span>
              </Button>
            </div>
            <div className="mx-1 h-5 w-px bg-border/60" />
          </>
        )}
        <Button
          variant={isConnecting ? 'default' : 'outline'}
          size="sm"
          className="h-7 gap-1.5 px-2"
          onClick={() => onConnectModeChange(isConnecting ? 'off' : 'connect')}
          title={t('editors.kg.toolbar.addRelationTooltip')}
          aria-pressed={isConnecting}
        >
          <Link2 className="size-3.5" />
          <span>{isConnecting ? t('editors.kg.toolbar.addingRelation') : t('editors.kg.toolbar.addRelation')}</span>
        </Button>
        {onExportHtml && (
          <>
            <div className="mx-1 h-5 w-px bg-border/60" />
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 px-2"
              onClick={onExportHtml}
              title={t('editors.kg.toolbar.exportHtmlTooltip')}
            >
              <Download className="size-3.5" />
              <span className="hidden md:inline">{t('editors.kg.toolbar.exportHtml')}</span>
            </Button>
          </>
        )}
        <div className="ml-auto text-xs text-muted-foreground">
          {hiddenCount > 0 ? (
            <>
              <span className="font-medium text-amber-600 dark:text-amber-400">
                {t('editors.kg.toolbar.showingNodes', {
                  count: nodeCount,
                  visible: nodeCount - hiddenCount,
                })}
              </span>
              {onOpenSettings && (
                <>
                  {' — '}
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    {t('editors.kg.toolbar.raiseLimit')}
                  </button>
                </>
              )}
            </>
          ) : (
            /* Two independent counts can't share i18next's single {{count}},
             * so each is pluralised on its own and composed -- same shape as
             * `editors.diagramTabs.linksFragment_one/_other`. */
            <>
              {t('editors.kg.toolbar.counts', {
                nodes: t('editors.kg.toolbar.nodesFragment', { count: nodeCount }),
                relations: t('editors.kg.toolbar.relationsFragment', { count: edgeCount }),
              })}
            </>
          )}
        </div>
      </div>
      {isConnecting && (
        <div className="text-[11px] text-muted-foreground">{t('editors.kg.toolbar.connectHint')}</div>
      )}
    </div>
  );
};
