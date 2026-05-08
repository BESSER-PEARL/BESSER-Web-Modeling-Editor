import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Circuit, Gate as GateInterface, GateType } from '../types';
import { GATE_SIZE, WIRE_SPACING, TOP_MARGIN, LEFT_MARGIN } from '../layout-constants';
import { Gate } from './Gate';
import { GATES } from '../constants';

interface DropPreviewPosition {
  col: number;
  row: number;
  isValid: boolean;
}

interface CircuitGridProps {
    circuit: Circuit;
    onGateDrop: (gateType: GateType, col: number, row: number) => void;
    draggedGate: { gate: GateType, x: number, y: number } | null;
    onDragStart?: (gate: GateType, e: React.MouseEvent, originalPos?: { col: number, row: number }, originalGate?: GateInterface) => void;
    onGateResize?: (col: number, row: number, newHeight: number) => void;
    onGateDoubleClick?: (col: number, row: number) => void;
    previewPosition?: DropPreviewPosition | null;
    selectedGate?: { col: number, row: number } | null;
    onGateSelect?: (col: number, row: number) => void;
    onInitialStateChange?: (row: number) => void;
    onAddQubit?: () => void;
}

export const CircuitGrid = forwardRef<HTMLDivElement, CircuitGridProps>(({ circuit, onGateDrop: _onGateDrop, draggedGate, onDragStart, onGateResize, onGateDoubleClick, previewPosition, selectedGate, onGateSelect, onInitialStateChange, onAddQubit }, ref) => {
    const qubitWires = Array.from({ length: circuit.qubitCount }, (_, i) => i);
    const classicalBitCount = circuit.classicalBitCount || 0;
    const classicalWires = Array.from({ length: classicalBitCount }, (_, i) => i);

    // Get initial state for a wire (defaults to |0⟩)
    const getInitialState = (row: number): string => {
        return circuit.initialStates?.[row] || '|0⟩';
    };

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

    // Clear selection when clicking on empty grid area
    const handleGridClick = () => {
        onGateSelect?.(-1, -1); // -1, -1 means deselect
    };

    return (
        <div
            ref={ref}
            onClick={handleGridClick}
            className="relative min-w-full min-h-full bg-[var(--quantum-editor-bg,#ffffff)] text-[var(--quantum-editor-text,#0f172a)]"
        >
            {/* Qubit name labels (q0, q1, etc.) */}
            {qubitWires.map(row => (
                <div
                    key={`qname-${row}`}
                    className="absolute left-[5px] z-[2] select-none px-1 py-0.5 font-mono text-xs text-[var(--quantum-editor-muted-text,#64748b)]"
                    style={{ top: TOP_MARGIN + row * WIRE_SPACING + GATE_SIZE / 2 - 10 }}
                >
                    q{row}
                </div>
            ))}

            {/* Qubit initial state labels (clickable) */}
            {qubitWires.map(row => (
                <div
                    key={`label-${row}`}
                    className="absolute left-[28px] z-[2] cursor-pointer select-none rounded-[3px] px-1 py-0.5 font-sans text-sm text-[var(--quantum-editor-text,#0f172a)] transition-colors duration-150 ease-linear hover:bg-[var(--quantum-editor-hover,rgba(56,189,248,0.16))] active:bg-[var(--quantum-editor-primary-soft,rgba(2,132,199,0.16))]"
                    style={{ top: TOP_MARGIN + row * WIRE_SPACING + GATE_SIZE / 2 - 10 }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onInitialStateChange?.(row);
                    }}
                    title="Click to cycle through initial states: |0⟩, |1⟩, |+⟩, |−⟩, |i⟩, |−i⟩"
                >
                    {getInitialState(row)}
                </div>
            ))}

            {/* Qubit wires */}
            {qubitWires.map(row => (
                <div
                    key={`qubit-${row}`}
                    className="absolute right-0 z-0 h-px bg-[var(--quantum-editor-wire,#1f2937)]"
                    style={{
                        left: LEFT_MARGIN,
                        top: TOP_MARGIN + row * WIRE_SPACING + GATE_SIZE / 2,
                    }}
                />
            ))}

            {/* Add qubit button - positioned at bottom left */}
            {onAddQubit && (
                <button
                    className="absolute bottom-2.5 left-[5px] z-[2] flex h-6 w-[60px] cursor-pointer items-center justify-center rounded-[3px] border border-dashed border-[var(--quantum-editor-border,#d5dde8)] bg-[var(--quantum-editor-surface,#f8fafc)] font-sans text-xs text-[var(--quantum-editor-muted-text,#64748b)] transition-all duration-150 ease-linear hover:border-[var(--quantum-editor-primary,#0284c7)] hover:bg-[var(--quantum-editor-hover,rgba(56,189,248,0.16))] hover:text-[var(--quantum-editor-primary,#0284c7)]"
                    onClick={(e) => {
                        e.stopPropagation();
                        onAddQubit();
                    }}
                    aria-label="Add qubit"
                    title="Add qubit"
                >
                    + Qubit
                </button>
            )}

            {/* Separator between qubits and classical bits */}
            {classicalBitCount > 0 && (
                <div
                    className="absolute inset-x-0 z-0 h-px"
                    style={{
                        top: TOP_MARGIN + circuit.qubitCount * WIRE_SPACING - 5,
                        background: 'linear-gradient(to right, var(--quantum-editor-border, #d5dde8) 50%, transparent 50%)',
                        backgroundSize: '8px 1px',
                    }}
                />
            )}

            {/* Classical bit labels */}
            {classicalWires.map(idx => (
                <div
                    key={`c-label-${idx}`}
                    className="absolute left-[5px] z-[2] select-none rounded-[3px] px-1 py-0.5 font-sans text-sm text-[var(--quantum-editor-muted-text,#64748b)]"
                    style={{ top: TOP_MARGIN + (circuit.qubitCount + idx) * WIRE_SPACING + GATE_SIZE / 2 - 10 }}
                    title="Measurement output - auto-generated from measurement gates"
                >
                    c{idx} ←
                </div>
            ))}

            {/* Classical bit wires (double line) */}
            {classicalWires.map(idx => {
                const row = circuit.qubitCount + idx;
                return (
                    <div
                        key={`c-wire-${idx}`}
                        className="classical-wire-divider absolute right-0 z-0 h-0 border-t border-b border-[var(--quantum-editor-wire,#1f2937)] py-0.5"
                        style={{
                            left: LEFT_MARGIN,
                            top: TOP_MARGIN + row * WIRE_SPACING + GATE_SIZE / 2 - 2,
                        }}
                    />
                );
            })}

            {/* Control wires */}
            {circuit.columns.map((_, colIndex) => {
                const controlWires = getControlWiresForColumn(colIndex);
                return controlWires.map((wire, wireIndex) => (
                    <div
                        key={`control-${colIndex}-${wireIndex}`}
                        className="absolute z-0 w-px bg-[var(--quantum-editor-wire,#1f2937)]"
                        style={{
                            left: LEFT_MARGIN + colIndex * WIRE_SPACING + GATE_SIZE / 2,
                            top: TOP_MARGIN + wire.startRow * WIRE_SPACING + GATE_SIZE / 2,
                            height: (wire.endRow - wire.startRow) * WIRE_SPACING,
                        }}
                    />
                ));
            })}

            {/* Gates */}
            {circuit.columns.map((column, colIndex) => (
                <React.Fragment key={colIndex}>
                    {column.gates.map((gate, rowIndex) => {
                        if (!gate || gate.type === 'OCCUPIED') return null;
                        const isSelected = selectedGate?.col === colIndex && selectedGate?.row === rowIndex;
                        return (
                            <div
                                key={`${colIndex}-${rowIndex}`}
                                className={cn(
                                    'absolute',
                                    isSelected ? 'z-[2] gate-selected-ring' : 'z-[1]',
                                )}
                                style={{
                                    left: LEFT_MARGIN + colIndex * WIRE_SPACING,
                                    top: TOP_MARGIN + rowIndex * WIRE_SPACING,
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onGateSelect?.(colIndex, rowIndex);
                                }}
                            >
                                <Gate
                                    gate={gate}
                                    onMouseDown={(e) => onDragStart && onDragStart(gate.type, e, { col: colIndex, row: rowIndex }, gate)}
                                    onResize={(newHeight) => onGateResize && onGateResize(colIndex, rowIndex, newHeight)}
                                    onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        if (gate.isFunctionGate) {
                                            onGateDoubleClick?.(colIndex, rowIndex);
                                        }
                                    }}
                                />
                            </div>
                        );
                    })}
                </React.Fragment>
            ))}

            {/* Drop Preview */}
            {previewPosition && draggedGate && (() => {
                const isValid = previewPosition.isValid;
                const gateHeight = getGateHeight(draggedGate.gate);
                return (
                    <div
                        className="quantum-drop-pulse absolute z-[5] rounded pointer-events-none border-2 border-dashed"
                        style={{
                            left: LEFT_MARGIN + previewPosition.col * WIRE_SPACING,
                            top: TOP_MARGIN + previewPosition.row * WIRE_SPACING,
                            width: GATE_SIZE,
                            height: GATE_SIZE + (gateHeight - 1) * WIRE_SPACING,
                            borderColor: isValid ? '#4CAF50' : '#e74c3c',
                            backgroundColor: isValid ? 'rgba(76, 175, 80, 0.2)' : 'rgba(231, 76, 60, 0.2)',
                            boxShadow: isValid
                                ? '0 0 10px rgba(76, 175, 80, 0.4)'
                                : '0 0 10px rgba(231, 76, 60, 0.4)',
                        }}
                    >
                        <div
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] font-bold"
                            style={{
                                color: isValid ? '#2e7d32' : '#c62828',
                                textShadow: '0 0 3px var(--quantum-editor-bg, #ffffff)',
                            }}
                        >
                            {isValid ? 'Drop here' : 'Invalid'}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
});
