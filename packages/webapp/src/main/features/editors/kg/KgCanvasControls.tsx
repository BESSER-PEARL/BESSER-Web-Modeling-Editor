import React, { useCallback, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Link2 } from 'lucide-react';
import {
  AutoLayoutIcon,
  FitViewIcon,
  RedoIcon,
  UndoIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '@besser/wme';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { CytoscapeCanvasHandle } from './CytoscapeCanvas';
import { KG_MAX_ZOOM, KG_MIN_ZOOM, type ConnectMode } from './types';

interface Props {
  /** The canvas the bar drives (zoom, fit, layout) and whose zoom it shows. */
  canvasRef: React.RefObject<CytoscapeCanvasHandle | null>;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  connectMode: ConnectMode;
  onConnectModeChange: (mode: ConnectMode) => void;
  onExportHtml: () => void;
}

const ICON_FILL = 'var(--besser-primary-contrast, #000000)';

// The bar's CSS fills its glyphs; Lucide's are stroked.
const STROKED = { fill: 'none' } as const;

/** One button of the bar. `label` is the accessible name and, unless
 *  `tooltip` says more, the tooltip. */
const ControlButton: React.FC<{
  label: string;
  tooltip?: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children: React.ReactNode;
}> = ({ label, tooltip, onClick, disabled = false, pressed, children }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      {/* The span keeps the tooltip working on a disabled button. */}
      <span>
        <button
          type="button"
          className={`control-button${disabled ? ' disabled' : ''}`}
          aria-label={label}
          aria-pressed={pressed}
          onClick={onClick}
          disabled={disabled}
        >
          {children}
        </button>
      </span>
    </TooltipTrigger>
    <TooltipContent side="left" className="max-w-64">
      {tooltip ?? label}
    </TooltipContent>
  </Tooltip>
);

/** The React Flow editors' controls bar (library `CustomControls`, same
 *  classes and glyphs) for the Cytoscape canvas: zoom | history | layout |
 *  zoom % | the KG's own relation mode and HTML export. */
export const KgCanvasControls: React.FC<Props> = ({
  canvasRef,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  connectMode,
  onConnectModeChange,
  onExportHtml,
}) => {
  const { t } = useTranslation();
  const zoom = useSyncExternalStore(
    useCallback((onChange: () => void) => canvasRef.current?.subscribeZoom(onChange) ?? (() => {}), [canvasRef]),
    () => canvasRef.current?.getZoom() ?? 1,
  );
  const isConnecting = connectMode === 'connect';
  const resetZoom = t('editors.kg.canvasControls.resetZoom');

  return (
    <TooltipProvider delayDuration={300}>
      <div className="besser-canvas-controls" role="toolbar" aria-orientation="vertical">
        <ControlButton
          label={t('editors.kg.canvasControls.zoomIn')}
          onClick={() => canvasRef.current?.zoomIn()}
          disabled={zoom >= KG_MAX_ZOOM}
        >
          <ZoomInIcon />
        </ControlButton>
        <ControlButton
          label={t('editors.kg.canvasControls.zoomOut')}
          onClick={() => canvasRef.current?.zoomOut()}
          disabled={zoom <= KG_MIN_ZOOM}
        >
          <ZoomOutIcon />
        </ControlButton>
        <ControlButton label={t('editors.kg.canvasControls.fitToView')} onClick={() => canvasRef.current?.fit()}>
          <FitViewIcon />
        </ControlButton>
        <span className="control-divider" aria-hidden="true" />
        <ControlButton label={t('editors.kg.toolbar.undoTooltip')} onClick={onUndo} disabled={!canUndo}>
          <UndoIcon fill={ICON_FILL} />
        </ControlButton>
        <ControlButton label={t('editors.kg.toolbar.redoTooltip')} onClick={onRedo} disabled={!canRedo}>
          <RedoIcon fill={ICON_FILL} />
        </ControlButton>
        <span className="control-divider" aria-hidden="true" />
        <ControlButton label={t('editors.kg.canvasControls.autoLayout')} onClick={() => canvasRef.current?.relayout()}>
          <AutoLayoutIcon fill={ICON_FILL} />
        </ControlButton>
        <span className="control-divider" aria-hidden="true" />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="control-zoom-readout"
              aria-label={resetZoom}
              onClick={() => canvasRef.current?.resetZoom()}
            >
              {Math.round(zoom * 100)}%
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">{resetZoom}</TooltipContent>
        </Tooltip>
        <span className="control-divider" aria-hidden="true" />
        <ControlButton
          label={t('editors.kg.toolbar.addRelation')}
          tooltip={t('editors.kg.toolbar.addRelationTooltip')}
          onClick={() => onConnectModeChange(isConnecting ? 'off' : 'connect')}
          pressed={isConnecting}
        >
          <Link2 strokeWidth={2.25} style={STROKED} />
        </ControlButton>
        <ControlButton
          label={t('editors.kg.toolbar.exportHtml')}
          tooltip={t('editors.kg.toolbar.exportHtmlTooltip')}
          onClick={onExportHtml}
        >
          <Download strokeWidth={2.25} style={STROKED} />
        </ControlButton>
      </div>
    </TooltipProvider>
  );
};
