import React, { forwardRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { Circuit, GateType } from '../types';
import { COLORS, GATE_SIZE, WIRE_SPACING, TOP_MARGIN, LEFT_MARGIN } from '../layout-constants';
import { Gate } from './Gate';
import { GATES } from '../constants';

const pulseAnimation = keyframes`
  0% { opacity: 0.4; transform: scale(0.95); }
  50% { opacity: 0.7; transform: scale(1.0); }
  100% { opacity: 0.4; transform: scale(0.95); }
`;

const GridContainer = styled.div`
  position: relative;
  min-width: 100%;
  min-height: 100%;
  background-color: ${COLORS.BACKGROUND};
`;

const Wire = styled.div<{ $row: number }>`
  position: absolute;
  left: ${LEFT_MARGIN}px;
  right: 0;
  top: ${props => TOP_MARGIN + props.$row * WIRE_SPACING + GATE_SIZE / 2}px;
  height: 1px;
  background-color: ${COLORS.STROKE};
  z-index: 0;
`;

const WireLabel = styled.div<{ $row: number }>`
  position: absolute;
  left: 5px;
  top: ${props => TOP_MARGIN + props.$row * WIRE_SPACING + GATE_SIZE / 2 - 10}px;
  font-size: 14px;
  font-family: sans-serif;
  color: black;
  z-index: 2;
`;

const ControlWire = styled.div<{ $col: number, $startRow: number, $endRow: number }>`
  position: absolute;
  left: ${props => LEFT_MARGIN + props.$col * WIRE_SPACING + GATE_SIZE / 2}px;
  top: ${props => TOP_MARGIN + props.$startRow * WIRE_SPACING + GATE_SIZE / 2}px;
  width: 1px;
  height: ${props => (props.$endRow - props.$startRow) * WIRE_SPACING}px;
  background-color: ${COLORS.STROKE};
  z-index: 0;
`;

const GateWrapper = styled.div<{ $col: number, $row: number }>`
  position: absolute;
  left: ${props => LEFT_MARGIN + props.$col * WIRE_SPACING}px;
  top: ${props => TOP_MARGIN + props.$row * WIRE_SPACING}px;
  z-index: 1;
`;

const DropPreview = styled.div<{ $col: number, $row: number, $height: number, $isValid: boolean }>`
  position: absolute;
  left: ${props => LEFT_MARGIN + props.$col * WIRE_SPACING}px;
  top: ${props => TOP_MARGIN + props.$row * WIRE_SPACING}px;
  width: ${GATE_SIZE}px;
  height: ${props => GATE_SIZE + (props.$height - 1) * WIRE_SPACING}px;
  border: 2px dashed ${props => props.$isValid ? '#4CAF50' : '#e74c3c'};
  border-radius: 4px;
  background-color: ${props => props.$isValid ? 'rgba(76, 175, 80, 0.2)' : 'rgba(231, 76, 60, 0.2)'};
  z-index: 5;
  pointer-events: none;
  animation: ${pulseAnimation} 1s ease-in-out infinite;
  box-shadow: ${props => props.$isValid 
    ? '0 0 10px rgba(76, 175, 80, 0.4)' 
    : '0 0 10px rgba(231, 76, 60, 0.4)'};
`;

const DropPreviewLabel = styled.div<{ $isValid: boolean }>`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 11px;
  font-weight: bold;
  color: ${props => props.$isValid ? '#2e7d32' : '#c62828'};
  white-space: nowrap;
  text-shadow: 0 0 3px white;
`;

interface DropPreviewPosition {
  col: number;
  row: number;
  isValid: boolean;
}

interface CircuitGridProps {
    circuit: Circuit;
    onGateDrop: (gateType: GateType, col: number, row: number) => void;
    draggedGate: { gate: GateType, x: number, y: number } | null;
    onDragStart?: (gate: GateType, e: React.MouseEvent, originalPos?: { col: number, row: number }) => void;
    onGateResize?: (col: number, row: number, newHeight: number) => void;
    previewPosition?: DropPreviewPosition | null;
}

export const CircuitGrid = forwardRef<HTMLDivElement, CircuitGridProps>(({ circuit, onGateDrop, draggedGate, onDragStart, onGateResize, previewPosition }, ref) => {
    const wires = Array.from({ length: circuit.qubitCount }, (_, i) => i);
    
    // Get gate height for preview
    const getGateHeight = (gateType: GateType): number => {
        const gateDefinition = GATES.find(g => g.type === gateType);
        return gateDefinition?.height || 1;
    };

    // Find control wires for each column
    const getControlWiresForColumn = (colIndex: number) => {
        const column = circuit.columns[colIndex];
        if (!column) return [];

        const controlWires: { startRow: number, endRow: number }[] = [];
        const controlRows: number[] = [];
        const targetRows: number[] = [];

        // Find all control and target gates in this column
        column.gates.forEach((gate, rowIndex) => {
            if (gate?.isControl) {
                controlRows.push(rowIndex);
            } else if (gate && !gate.isControl) {
                targetRows.push(rowIndex);
            }
        });

        // Create control wires connecting controls to targets
        if (controlRows.length > 0 && targetRows.length > 0) {
            const minRow = Math.min(...controlRows, ...targetRows);
            const maxRow = Math.max(...controlRows, ...targetRows);
            controlWires.push({ startRow: minRow, endRow: maxRow });
        }

        return controlWires;
    };

    return (
        <GridContainer ref={ref}>
            {/* Wire labels */}
            {wires.map(row => (
                <WireLabel key={`label-${row}`} $row={row}>
                    |0⟩
                </WireLabel>
            ))}

            {/* Wires */}
            {wires.map(row => (
                <Wire key={row} $row={row} />
            ))}

            {/* Control wires */}
            {circuit.columns.map((_, colIndex) => {
                const controlWires = getControlWiresForColumn(colIndex);
                return controlWires.map((wire, wireIndex) => (
                    <ControlWire
                        key={`control-${colIndex}-${wireIndex}`}
                        $col={colIndex}
                        $startRow={wire.startRow}
                        $endRow={wire.endRow}
                    />
                ));
            })}

            {/* Gates */}
            {circuit.columns.map((column, colIndex) => (
                <React.Fragment key={colIndex}>
                    {column.gates.map((gate, rowIndex) => {
                        if (!gate || gate.type === 'OCCUPIED') return null;
                        return (
                            <GateWrapper key={`${colIndex}-${rowIndex}`} $col={colIndex} $row={rowIndex}>
                                <Gate
                                    gate={gate}
                                    onMouseDown={(e) => onDragStart && onDragStart(gate.type, e, { col: colIndex, row: rowIndex })}
                                    onResize={(newHeight) => onGateResize && onGateResize(colIndex, rowIndex, newHeight)}
                                />
                            </GateWrapper>
                        );
                    })}
                </React.Fragment>
            ))}

            {/* Drop Preview */}
            {previewPosition && draggedGate && (
                <DropPreview
                    $col={previewPosition.col}
                    $row={previewPosition.row}
                    $height={getGateHeight(draggedGate.gate)}
                    $isValid={previewPosition.isValid}
                >
                    <DropPreviewLabel $isValid={previewPosition.isValid}>
                        {previewPosition.isValid ? 'Drop here' : 'Invalid'}
                    </DropPreviewLabel>
                </DropPreview>
            )}
        </GridContainer>
    );
});
