import React from 'react';
import { Maximize2, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onResetLayout: () => void;
}

/** Floating viewport controls pinned to the bottom-right of the KG canvas,
 *  mirroring the class-diagram editor's zoom pane: a stacked +/- pair, with
 *  fit-to-view and re-run-layout sitting directly above them. */
export const KgCanvasControls: React.FC<Props> = ({ onZoomIn, onZoomOut, onFit, onResetLayout }) => (
  <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-2">
    <Button
      variant="outline"
      size="icon"
      className="size-9 shadow-sm"
      onClick={onResetLayout}
      title="Re-run the current layout on the visible nodes"
      aria-label="Reset layout"
    >
      <RefreshCcw className="size-4" />
    </Button>
    <Button
      variant="outline"
      size="icon"
      className="size-9 shadow-sm"
      onClick={onFit}
      title="Fit to view"
      aria-label="Fit to view"
    >
      <Maximize2 className="size-4" />
    </Button>
    <Button
      variant="outline"
      size="icon"
      className="size-9 text-lg leading-none shadow-sm"
      onClick={onZoomIn}
      title="Zoom in"
      aria-label="Zoom in"
    >
      +
    </Button>
    <Button
      variant="outline"
      size="icon"
      className="size-9 text-lg leading-none shadow-sm"
      onClick={onZoomOut}
      title="Zoom out"
      aria-label="Zoom out"
    >
      −
    </Button>
  </div>
);
