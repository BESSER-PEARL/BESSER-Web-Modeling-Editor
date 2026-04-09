import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Gate as GateType } from '../types';
import { GATE_SIZE, WIRE_SPACING, COLORS } from '../layout-constants';
import { useTooltip } from './Tooltip';

interface GateContainerProps {
  width: number;
  height: number;
  isControl: boolean;
  backgroundColor?: string;
  noBorder?: boolean;
  children?: React.ReactNode;
  onMouseDown?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
  style?: React.CSSProperties;
}

function GateContainer({
  width,
  height,
  isControl,
  backgroundColor,
  noBorder,
  children,
  onMouseDown,
  onDoubleClick,
  onMouseEnter,
  onMouseLeave,
  style,
}: GateContainerProps) {
  const isTransparent = isControl || noBorder;

  return (
    <div
      className={cn(
        'relative flex items-center justify-center cursor-pointer select-none font-sans text-sm font-bold text-black transition-colors duration-100',
        isControl ? 'rounded-full' : 'rounded-sm',
        !isTransparent && 'border border-[var(--quantum-editor-stroke,black)] hover:bg-[var(--quantum-editor-highlighted-gate-fill,#FB7)]',
        isTransparent && 'border-none bg-transparent hover:bg-transparent',
      )}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        ...(!isTransparent
          ? { backgroundColor: backgroundColor || COLORS.GATE_FILL }
          : {}),
        ...style,
      }}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
}

function ControlDot({ isAntiControl }: { isAntiControl: boolean }) {
  return (
    <div
      className={cn(
        'size-3 rounded-full',
        isAntiControl
          ? 'bg-[var(--quantum-editor-bg,#ffffff)] border-2 border-[var(--quantum-editor-wire,#1f2937)]'
          : 'bg-[var(--quantum-editor-wire,#1f2937)] border-none',
      )}
    />
  );
}

function ResizeTab({
  show,
  onMouseDown,
}: {
  show: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className={cn(
        'absolute -bottom-0.5 -right-0.5 size-4 rounded-sm cursor-ns-resize items-center justify-center text-[10px] z-10',
        'bg-[var(--quantum-editor-highlighted-gate-fill,#FB7)] border border-[var(--quantum-editor-stroke,black)]',
        'hover:bg-[#ffcc7a]',
        "after:content-['⇕'] after:text-[var(--quantum-editor-text,#0f172a)]",
        show ? 'flex' : 'hidden',
      )}
      onMouseDown={onMouseDown}
    />
  );
}

function NestedIndicator() {
  return (
    <div
      className="absolute top-0.5 right-0.5 size-2 rounded-full bg-[#4CAF50] border border-[var(--quantum-editor-bg,#ffffff)] z-10"
      title="Nested circuit configured"
    />
  );
}

interface GateProps {
  gate: GateType;
  onMouseDown?: (e: React.MouseEvent) => void;
  onResize?: (newHeight: number) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  isDragging?: boolean;
}

export function Gate({ gate, onMouseDown, onResize, onDoubleClick, isDragging = false }: GateProps): JSX.Element {
  const [showResizeTab, setShowResizeTab] = useState(false);
  const { showTooltip, hideTooltip } = useTooltip();
  const width = (gate.width || 1) * GATE_SIZE;
  const height = (gate.height || 1) * WIRE_SPACING;
  const isControl = gate.isControl || false;
  const isAntiControl = gate.type === 'ANTI_CONTROL';
  const canResize = gate.canResize || false;
  const isFunctionGate = gate.isFunctionGate || false;
  const hasNestedCircuit = isFunctionGate && gate.nestedCircuit && gate.nestedCircuit.columns.length > 0;

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (isDragging) return;
    setShowResizeTab(true);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const tooltip = isFunctionGate
      ? `${gate.label} - Double-click to edit nested circuit${hasNestedCircuit ? ' (configured)' : ' (empty)'}`
      : (gate.description || '');
    showTooltip(rect.right + 5, rect.top, gate.label || gate.type, tooltip);
  };

  const handleMouseLeave = () => {
    setShowResizeTab(false);
    hideTooltip();
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const startY = e.clientY;
    const startHeight = gate.height || 1;
    const minHeight = gate.minHeight || 2;
    const maxHeight = gate.maxHeight || 16;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const deltaRows = Math.round(deltaY / WIRE_SPACING);
      const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaRows));

      if (newHeight !== startHeight && onResize) {
        onResize(newHeight);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // If gate has a custom drawer, use it
  if (gate.drawer) {
    return (
      <GateContainer
        width={width}
        height={height}
        isControl={isControl}
        noBorder={gate.noBorder}
        onMouseDown={onMouseDown}
        onDoubleClick={isFunctionGate ? onDoubleClick : undefined}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ opacity: isDragging ? 0.5 : 1, cursor: isFunctionGate ? 'pointer' : 'grab' }}
      >
        {gate.drawer({ rect: { x: 0, y: 0, width, height } })}
        {hasNestedCircuit && <NestedIndicator />}
        {canResize && (
          <ResizeTab
            show={showResizeTab}
            onMouseDown={handleResizeMouseDown}
          />
        )}
      </GateContainer>
    );
  }

  // Control/Anti-control gates get special rendering
  if (isControl) {
    return (
      <GateContainer
        width={GATE_SIZE}
        height={GATE_SIZE}
        isControl={true}
        onMouseDown={onMouseDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ opacity: isDragging ? 0.5 : 1 }}
      >
        <ControlDot isAntiControl={isAntiControl} />
      </GateContainer>
    );
  }

  // Default gate rendering with symbol
  return (
    <GateContainer
      width={width}
      height={height}
      isControl={false}
      backgroundColor={gate.backgroundColor}
      onMouseDown={onMouseDown}
      onDoubleClick={isFunctionGate ? onDoubleClick : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ opacity: isDragging ? 0.5 : 1, cursor: isFunctionGate ? 'pointer' : 'grab' }}
    >
      {isFunctionGate ? gate.label : (gate.symbol || gate.label)}
      {hasNestedCircuit && <NestedIndicator />}
      {canResize && (
        <ResizeTab
          show={showResizeTab}
          onMouseDown={handleResizeMouseDown}
        />
      )}
    </GateContainer>
  );
}
