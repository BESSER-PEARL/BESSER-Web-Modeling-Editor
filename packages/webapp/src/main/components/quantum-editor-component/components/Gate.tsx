import React, { useState } from 'react';
import styled from 'styled-components';
import { Gate as GateType } from '../types';
import { GATE_SIZE, WIRE_SPACING, COLORS } from '../layout-constants';
import { useTooltip } from './Tooltip';

const GateContainer = styled.div<{ $width: number, $height: number, $isControl: boolean, $backgroundColor?: string, $noBorder?: boolean }>`
  position: relative;
  width: ${props => props.$width}px;
  height: ${props => props.$height}px;
  display: flex;
  align-items: center;
  justify-content: center;
  justify-content: center;
  background-color: ${props => props.$isControl || props.$noBorder ? 'transparent' : (props.$backgroundColor || COLORS.GATE_FILL)};
  border: ${props => props.$isControl || props.$noBorder ? 'none' : `1px solid ${COLORS.STROKE}`};
  border-radius: ${props => props.$isControl ? '50%' : '2px'};
  cursor: pointer;
  user-select: none;
  font-family: sans-serif;
  font-size: 14px;
  font-weight: bold;
  transition: background-color 0.1s;

  &:hover {
    background-color: ${props => props.$isControl ? 'transparent' : COLORS.HIGHLIGHTED_GATE_FILL};
  }
`;

const ControlDot = styled.div<{ $isAntiControl: boolean }>`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: ${props => props.$isAntiControl ? 'white' : 'black'};
  border: ${props => props.$isAntiControl ? '2px solid black' : 'none'};
`;

const ResizeTab = styled.div<{ $show: boolean }>`
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 16px;
  height: 16px;
  background-color: ${COLORS.HIGHLIGHTED_GATE_FILL};
  border: 1px solid ${COLORS.STROKE};
  border-radius: 2px;
  cursor: ns-resize;
  display: ${props => props.$show ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  font-size: 10px;
  z-index: 10;

  &:hover {
    background-color: #FFA;
  }

  &::after {
    content: '⇕';
    color: #666;
  }
`;

interface GateProps {
  gate: GateType;
  onMouseDown?: (e: React.MouseEvent) => void;
  onResize?: (newHeight: number) => void;
  isDragging?: boolean;
}

export function Gate({ gate, onMouseDown, onResize, isDragging = false }: GateProps): JSX.Element {
  const [showResizeTab, setShowResizeTab] = useState(false);
  const { showTooltip, hideTooltip } = useTooltip();
  const width = (gate.width || 1) * GATE_SIZE;
  const height = (gate.height || 1) * WIRE_SPACING;
  const isControl = gate.isControl || false;
  const isAntiControl = gate.type === 'ANTI_CONTROL';
  const canResize = gate.canResize || false;

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (isDragging) return;
    setShowResizeTab(true);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    showTooltip(rect.right + 5, rect.top, gate.label || gate.type, gate.description || '');
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
        $width={width}
        $height={height}
        $isControl={isControl}
        $noBorder={gate.noBorder}
        onMouseDown={onMouseDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ opacity: isDragging ? 0.5 : 1 }}
      >
        {gate.drawer({ rect: { x: 0, y: 0, width, height } })}
        {canResize && (
          <ResizeTab
            $show={showResizeTab}
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
        $width={GATE_SIZE}
        $height={GATE_SIZE}
        $isControl={true}
        onMouseDown={onMouseDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ opacity: isDragging ? 0.5 : 1 }}
      >
        <ControlDot $isAntiControl={isAntiControl} />
      </GateContainer>
    );
  }

  // Default gate rendering with symbol
  return (
    <GateContainer
      $width={width}
      $height={height}
      $isControl={false}
      $backgroundColor={gate.backgroundColor}
      onMouseDown={onMouseDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      {gate.symbol || gate.label}
      {canResize && (
        <ResizeTab
          $show={showResizeTab}
          onMouseDown={handleResizeMouseDown}
        />
      )}
    </GateContainer>
  );
}
