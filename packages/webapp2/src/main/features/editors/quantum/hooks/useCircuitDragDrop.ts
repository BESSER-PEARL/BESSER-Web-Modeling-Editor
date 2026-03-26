import { useCallback, useRef, useState } from 'react';
import { Circuit, Gate, GateType } from '../types';
import { GATES } from '../constants';
import { trimCircuit } from '../utils';
import {
    GATE_SIZE,
    WIRE_SPACING,
    TOP_MARGIN,
    LEFT_MARGIN,
} from '../layout-constants';

export interface DragState {
    gate: GateType;
    offset: { x: number; y: number };
    originalPos?: { col: number; row: number };
    originalGate?: Gate; // Full gate object to preserve nestedCircuit and other properties
}

export interface PreviewPosition {
    col: number;
    row: number;
    isValid: boolean;
}

interface UseCircuitDragDropOptions {
    circuit: Circuit;
    setCircuit: (updater: (prev: Circuit) => Circuit) => void;
    circuitGridRef: React.RefObject<HTMLDivElement>;
}

interface UseCircuitDragDropReturn {
    draggedGate: DragState | null;
    mousePos: { x: number; y: number };
    previewPosition: PreviewPosition | null;
    handleDragStart: (gate: GateType, e: React.MouseEvent, originalPos?: { col: number; row: number }, originalGate?: Gate) => void;
    handleMouseMove: (e: React.MouseEvent) => void;
    handleMouseUp: (e: React.MouseEvent) => void;
}

/**
 * Custom hook to handle all drag and drop logic for the circuit editor
 */
export function useCircuitDragDrop({
    circuit,
    setCircuit,
    circuitGridRef,
}: UseCircuitDragDropOptions): UseCircuitDragDropReturn {
    const [draggedGate, setDraggedGate] = useState<DragState | null>(null);
    const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [previewPosition, setPreviewPosition] = useState<PreviewPosition | null>(null);

    // Measurement gate types - after measurement, qubit becomes classical
    const MEASUREMENT_GATES = ['MEASURE', 'MEASURE_X', 'MEASURE_Y'];

    // Gates that can be placed after measurement (classical operations, resets, etc.)
    const GATES_ALLOWED_AFTER_MEASUREMENT = [
        // Another measurement is allowed
        'MEASURE', 'MEASURE_X', 'MEASURE_Y',
        // Reset brings qubit back to quantum state
        'RESET',
        // Control and anti-control (can act as classical control)
        'CONTROL', 'ANTI_CONTROL',
        // Classical control gates (X controlled by classical bit)
        'CLASSICALLY_CONTROLLED_X',
        // Display/visualization gates (if they exist)
        'DISPLAY',
        // Spacer/identity (doesn't affect state)
        'SPACER', 'I',
    ];

    // Check if a gate type is allowed after measurement
    const isGateAllowedAfterMeasurement = useCallback(
        (gateType: GateType): boolean => {
            return GATES_ALLOWED_AFTER_MEASUREMENT.includes(gateType);
        },
        []
    );

    // Check if a qubit has been measured before a given column
    const isQubitMeasuredBefore = useCallback(
        (qubitRow: number, beforeCol: number): boolean => {
            for (let c = 0; c < beforeCol && c < circuit.columns.length; c++) {
                const gate = circuit.columns[c]?.gates[qubitRow];
                if (gate && MEASUREMENT_GATES.includes(gate.type)) {
                    return true;
                }
                // Also check if this row is part of a multi-qubit measurement gate
                // by looking for OCCUPIED cells and tracing back to the parent gate
                if (gate && gate.type === 'OCCUPIED') {
                    // Find the parent gate by searching upward
                    for (let r = qubitRow - 1; r >= 0; r--) {
                        const parentGate = circuit.columns[c]?.gates[r];
                        if (parentGate && parentGate.type !== 'OCCUPIED') {
                            if (MEASUREMENT_GATES.includes(parentGate.type)) {
                                return true;
                            }
                            break;
                        }
                    }
                }
            }
            return false;
        },
        [circuit]
    );

    // Calculate preview position when dragging
    const calculatePreviewPosition = useCallback(
        (clientX: number, clientY: number, gateType: GateType): PreviewPosition | null => {
            if (!circuitGridRef.current || !draggedGate) return null;

            const rect = circuitGridRef.current.getBoundingClientRect();
            
            // Adjust for drag offset to get the center of the gate
            // The gate center is at mouse position minus offset plus half gate size
            const gateCenterX = clientX - draggedGate.offset.x + GATE_SIZE / 2;
            const gateCenterY = clientY - draggedGate.offset.y + GATE_SIZE / 2;
            
            const x = gateCenterX - rect.left - LEFT_MARGIN;
            const y = gateCenterY - rect.top - TOP_MARGIN;

            // Calculate snapped grid position based on gate center
            const col = Math.floor(x / WIRE_SPACING);
            const row = Math.floor(y / WIRE_SPACING);

            // Get gate height
            const gateDefinition = GATES.find((g) => g.type === gateType);
            const gateHeight = gateDefinition?.height || 1;

            // Check if position is valid
            const isWithinBounds = col >= 0 && row >= 0 && row + gateHeight <= 16;

            // Check if any qubit in the gate's range has been measured before this column
            // But allow gates that are specifically permitted after measurement
            let isBlockedByMeasurement = false;
            if (isWithinBounds && !isGateAllowedAfterMeasurement(gateType)) {
                for (let i = 0; i < gateHeight; i++) {
                    if (isQubitMeasuredBefore(row + i, col)) {
                        isBlockedByMeasurement = true;
                        break;
                    }
                }
            }

            // Check if position would be available (considering existing gates)
            let isPositionAvailable = true;
            if (isWithinBounds && col < circuit.columns.length) {
                for (let i = 0; i < gateHeight; i++) {
                    const targetRow = row + i;
                    const existingGate = circuit.columns[col]?.gates[targetRow];
                    // Any existing gate (including OCCUPIED cells from multi-qubit gates) blocks placement
                    if (existingGate) {
                        // Allow if it's the same gate being moved (check both the gate itself and its OCCUPIED cells)
                        if (draggedGate?.originalPos) {
                            const origCol = draggedGate.originalPos.col;
                            const origRow = draggedGate.originalPos.row;
                            const origGate = draggedGate.originalGate;
                            const origHeight = origGate?.height || 1;
                            
                            // Check if targetRow is within the original gate's range
                            if (col === origCol && targetRow >= origRow && targetRow < origRow + origHeight) {
                                continue;
                            }
                        }
                        isPositionAvailable = false;
                        break;
                    }
                }
            }

            const isValid = isWithinBounds && isPositionAvailable && !isBlockedByMeasurement;

            return { col: Math.max(0, col), row: Math.max(0, row), isValid };
        },
        [circuit, draggedGate, circuitGridRef, isQubitMeasuredBefore, isGateAllowedAfterMeasurement]
    );

    const handleDragStart = useCallback(
        (gate: GateType, e: React.MouseEvent, originalPos?: { col: number; row: number }, originalGate?: Gate) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setDraggedGate({
                gate,
                offset: {
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                },
                originalPos,
                originalGate,
            });
            setMousePos({ x: e.clientX, y: e.clientY });
            e.stopPropagation();
        },
        []
    );

    const handleMouseMove = useCallback(
        (e: React.MouseEvent) => {
            if (draggedGate) {
                setMousePos({ x: e.clientX, y: e.clientY });

                // Calculate and update preview position
                const preview = calculatePreviewPosition(e.clientX, e.clientY, draggedGate.gate);
                setPreviewPosition(preview);
            }
        },
        [draggedGate, calculatePreviewPosition]
    );

    const handleGateDelete = useCallback(
        (pos: { col: number; row: number }) => {
            setCircuit((prev) => {
                const newColumns = [...prev.columns];
                if (newColumns[pos.col]) {
                    const newGates = [...newColumns[pos.col].gates];
                    newGates[pos.row] = null;
                    newColumns[pos.col] = { ...newColumns[pos.col], gates: newGates };
                }
                return trimCircuit({ ...prev, columns: newColumns });
            });
        },
        [setCircuit]
    );

    const handleGateDrop = useCallback(
        (gateType: GateType, col: number, row: number, originalPos?: { col: number; row: number }, originalGate?: Gate) => {
            setCircuit((prev) => {
                // Find the full gate definition from GATES
                const gateDefinition = GATES.find((g) => g.type === gateType);
                if (!gateDefinition) {
                    console.error('Gate definition not found for type:', gateType);
                    return prev;
                }

                const gateHeight = gateDefinition.height || 1;

                // Calculate required wire count (ensure gate fits + expand up to 16)
                const requiredWires = Math.max(prev.qubitCount, row + gateHeight);
                const newWireCount = Math.min(16, Math.max(prev.qubitCount, requiredWires));

                const newColumns = [...prev.columns];

                // If moving, remove from old position first
                if (originalPos) {
                    if (newColumns[originalPos.col]) {
                        const oldGates = [...newColumns[originalPos.col].gates];
                        const oldGate = oldGates[originalPos.row];
                        const oldHeight = oldGate?.height || 1;
                        for (let i = 0; i < oldHeight; i++) {
                            oldGates[originalPos.row + i] = null;
                        }
                        newColumns[originalPos.col] = { ...newColumns[originalPos.col], gates: oldGates };
                    }
                }

                // Ensure columns exist up to the dropped position
                while (newColumns.length <= col) {
                    newColumns.push({ gates: Array(newWireCount).fill(null) });
                }

                // Expand all existing columns to new wire count if needed
                if (newWireCount > prev.qubitCount) {
                    for (let i = 0; i < newColumns.length; i++) {
                        const currentGates = newColumns[i].gates;
                        if (currentGates.length < newWireCount) {
                            newColumns[i] = {
                                gates: [
                                    ...currentGates,
                                    ...Array(newWireCount - currentGates.length).fill(null),
                                ],
                            };
                        }
                    }
                }

                // Helper function to check if a position range is available
                const isPositionAvailable = (targetCol: number, targetRow: number, height: number): boolean => {
                    if (targetCol >= newColumns.length) return true;

                    for (let i = 0; i < height; i++) {
                        if (targetRow + i >= newWireCount) return false;
                        if (newColumns[targetCol].gates[targetRow + i] !== null) {
                            return false;
                        }
                    }
                    return true;
                };

                // Calculate the last non-empty column index
                let lastNonEmptyCol = -1;
                for (let i = newColumns.length - 1; i >= 0; i--) {
                    if (!newColumns[i].gates.every((g) => g === null)) {
                        lastNonEmptyCol = i;
                        break;
                    }
                }

                // Clamp the target column
                let targetCol = Math.min(col, lastNonEmptyCol + 1);

                // Check if the gate would fit vertically
                if (row + gateHeight > newWireCount) {
                    console.warn('Gate would exceed wire count at this row');
                    return prev;
                }

                // Ensure columns exist up to the target position
                while (newColumns.length <= targetCol) {
                    newColumns.push({ gates: Array(newWireCount).fill(null) });
                }

                // Find available column (with safety limit)
                const maxIterations = 100;
                let iterations = 0;
                while (!isPositionAvailable(targetCol, row, gateHeight) && iterations < maxIterations) {
                    targetCol++;
                    iterations++;
                    while (newColumns.length <= targetCol) {
                        newColumns.push({ gates: Array(newWireCount).fill(null) });
                    }
                }

                if (iterations >= maxIterations) {
                    console.error('Could not find valid position for gate');
                    return prev;
                }

                // Place the gate
                const newGates = [...newColumns[targetCol].gates];
                // Preserve original gate properties (including nestedCircuit) when moving
                const newGate = originalGate ? {
                    ...gateDefinition,
                    ...originalGate,
                    id: Date.now().toString(),
                } : {
                    ...gateDefinition,
                    id: Date.now().toString(),
                };

                newGates[row] = newGate;

                // Mark occupied rows
                for (let i = 1; i < gateHeight; i++) {
                    if (row + i < newWireCount) {
                        newGates[row + i] = {
                            type: 'OCCUPIED',
                            id: `${newGate.id}_occupied_${i}`,
                            label: '',
                            height: 1,
                            width: 1,
                        };
                    }
                }

                newColumns[targetCol] = { ...newColumns[targetCol], gates: newGates };

                return trimCircuit({ qubitCount: newWireCount, columns: newColumns });
            });
        },
        [setCircuit]
    );

    const handleMouseUp = useCallback(
        (e: React.MouseEvent) => {
            if (draggedGate) {
                let droppedOnGrid = false;
                if (circuitGridRef.current) {
                    const rect = circuitGridRef.current.getBoundingClientRect();
                    
                    // Use gate center for drop calculation (same as preview)
                    const gateCenterX = e.clientX - draggedGate.offset.x + GATE_SIZE / 2;
                    const gateCenterY = e.clientY - draggedGate.offset.y + GATE_SIZE / 2;
                    
                    const x = gateCenterX - rect.left - LEFT_MARGIN;
                    const y = gateCenterY - rect.top - TOP_MARGIN;

                    if (x >= -GATE_SIZE && y >= -GATE_SIZE && x <= rect.width && y <= rect.height) {
                        const col = Math.floor(x / WIRE_SPACING);
                        const row = Math.floor(y / WIRE_SPACING);

                        const gateDefinition = GATES.find((g) => g.type === draggedGate.gate);
                        const gateHeight = gateDefinition?.height || 1;

                        // Check if any qubit in the gate's range has been measured before this column
                        // But allow gates that are specifically permitted after measurement
                        let isBlockedByMeasurement = false;
                        if (!isGateAllowedAfterMeasurement(draggedGate.gate)) {
                            for (let i = 0; i < gateHeight; i++) {
                                if (isQubitMeasuredBefore(row + i, col)) {
                                    isBlockedByMeasurement = true;
                                    break;
                                }
                            }
                        }

                        // Only drop if position is valid and not blocked by measurement
                        if (col >= 0 && row >= 0 && row < 16 && row + gateHeight <= 16 && !isBlockedByMeasurement) {
                            handleGateDrop(draggedGate.gate, col, row, draggedGate.originalPos, draggedGate.originalGate);
                            droppedOnGrid = true;
                        }
                    }
                }

                if (!droppedOnGrid && draggedGate.originalPos) {
                    handleGateDelete(draggedGate.originalPos);
                }

                setDraggedGate(null);
                setPreviewPosition(null);
            }
        },
        [draggedGate, circuitGridRef, handleGateDrop, handleGateDelete, isQubitMeasuredBefore, isGateAllowedAfterMeasurement]
    );

    return {
        draggedGate,
        mousePos,
        previewPosition,
        handleDragStart,
        handleMouseMove,
        handleMouseUp,
    };
}
