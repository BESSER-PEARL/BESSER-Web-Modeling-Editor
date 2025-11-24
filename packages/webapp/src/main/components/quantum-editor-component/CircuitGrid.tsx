import React, { forwardRef } from 'react';
import styled from 'styled-components';
import { Circuit, GateType } from './types';
import { COLORS, GATE_SIZE, WIRE_SPACING, TOP_MARGIN, LEFT_MARGIN } from './layout-constants';
import { Gate } from './Gate';

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

interface CircuitGridProps {
    circuit: Circuit;
    onGateDrop: (gateType: GateType, col: number, row: number) => void;
    draggedGate: { gate: GateType, x: number, y: number } | null;
    onDragStart?: (gate: GateType, e: React.MouseEvent, originalPos?: { col: number, row: number }) => void;
    onGateResize?: (col: number, row: number, newHeight: number) => void;
}

export const CircuitGrid = forwardRef<HTMLDivElement, CircuitGridProps>(({ circuit, onGateDrop, draggedGate, onDragStart, onGateResize }, ref) => {
    const wires = Array.from({ length: circuit.qubitCount }, (_, i) => i);

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
        </GridContainer>
    );
});
