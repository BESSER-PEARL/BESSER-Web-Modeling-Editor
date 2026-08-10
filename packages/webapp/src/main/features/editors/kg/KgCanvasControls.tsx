import React from 'react';
import { Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onResetLayout: () => void;
}

/** Floating viewport controls pinned to the bottom-right of the KG canvas,
 *  mirroring the class-diagram editor's zoom pane: a stacked +/- pair, with
 *  fit-to-view and auto-layout sitting directly above them. */
export const KgCanvasControls: React.FC<Props> = ({ onZoomIn, onZoomOut, onFit, onResetLayout }) => (
  <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-2">
    <Button
      variant="outline"
      size="icon"
      className="size-9 shadow-sm"
      onClick={onResetLayout}
      title="Auto layout"
      aria-label="Auto layout"
    >
      {/* Same glyph as the class-diagram editor's auto-layout button
       *  (`packages/editor/.../canvas/zoom-pane.tsx`) so both canvases read alike. */}
      <svg
        className="size-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="9" y="3" width="6" height="5" rx="1" />
        <rect x="2" y="16" width="6" height="5" rx="1" />
        <rect x="16" y="16" width="6" height="5" rx="1" />
        <path d="M12 8v4M5 16v-2h14v2" />
      </svg>
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
