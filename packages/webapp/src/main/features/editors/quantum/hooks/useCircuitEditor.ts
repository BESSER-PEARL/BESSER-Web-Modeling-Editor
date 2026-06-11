import { useState, useCallback, useEffect, useRef } from 'react';
import { Circuit, Gate, CircuitColumn } from '../types';
import { GATES } from '../constants';
import { trimCircuit } from '../utils';
import { useUndoRedo } from './useUndoRedo';
import { GATE_SIZE, WIRE_SPACING } from '../layout-constants';

interface UseCircuitEditorOptions {
    initialCircuit: Circuit;
    onCircuitChange?: (circuit: Circuit) => void;
}

interface DragState {
    gate: string;
    offset: { x: number; y: number };
}

interface PreviewPosition {
    col: number;
    row: number;
    isValid: boolean;
}

export interface CircuitEditorState {
    // Circuit state with undo/redo
    circuit: Circuit;
    setCircuit: (updater: Circuit | ((prev: Circuit) => Circuit)) => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;

    // Selection
    selectedGate: { col: number; row: number } | null;
    setSelectedGate: (gate: { col: number; row: number } | null) => void;

    // Drag and drop
    draggedGate: DragState | null;
    mousePos: { x: number; y: number };
    previewPosition: PreviewPosition | null;
    handleDragStart: (gateType: string, e: React.MouseEvent) => void;
    handleMouseMove: (e: React.MouseEvent, gridRef: React.RefObject<HTMLDivElement>) => void;
    handleMouseUp: () => void;

    // Clipboard
    copiedGate: Gate | null;
    handleCopy: () => void;
    handlePaste: () => void;
    handleDelete: () => void;

    // Gate resize
    handleGateResize: (col: number, row: number, newHeight: number) => void;
}

/**
 * Unified hook for circuit editing functionality.
 * Used by both the main QuantumEditorComponent and NestedCircuitModal.
 */
export function useCircuitEditor({
    initialCircuit,
    onCircuitChange,
}: UseCircuitEditorOptions): CircuitEditorState {
    // Circuit state with undo/redo
    const {
        state: circuit,
        setState: setCircuit,
        undo,
        redo,
        canUndo,
        canRedo,
    } = useUndoRedo(initialCircuit);

    // Notify parent of circuit changes
    useEffect(() => {
        onCircuitChange?.(circuit);
    }, [circuit, onCircuitChange]);

    // Selection state
    const [selectedGate, setSelectedGate] = useState<{ col: number; row: number } | null>(null);

    // Drag and drop state
    const [draggedGate, setDraggedGate] = useState<DragState | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [previewPosition, setPreviewPosition] = useState<PreviewPosition | null>(null);

    // Clipboard state
    const [copiedGate, setCopiedGate] = useState<Gate | null>(null);

    // Refs for stable access in event handlers
    const circuitRef = useRef(circuit);
    const selectedGateRef = useRef(selectedGate);
    const copiedGateRef = useRef(copiedGate);

    useEffect(() => {
        circuitRef.current = circuit;
    }, [circuit]);

    useEffect(() => {
        selectedGateRef.current = selectedGate;
    }, [selectedGate]);

    useEffect(() => {
        copiedGateRef.current = copiedGate;
    }, [copiedGate]);

    // Drag and drop handlers
    const handleDragStart = useCallback((gateType: string, e: React.MouseEvent) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setDraggedGate({
            gate: gateType,
            offset: {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            },
        });
        setSelectedGate(null);
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent, gridRef: React.RefObject<HTMLDivElement>) => {
        if (!draggedGate || !gridRef.current) return;

        const rect = gridRef.current.getBoundingClientRect();
        const relativeX = e.clientX - rect.left + gridRef.current.scrollLeft;
        const relativeY = e.clientY - rect.top + gridRef.current.scrollTop;

        setMousePos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        });

        const LEFT_MARGIN = 60;
        const TOP_MARGIN = 20;
        const col = Math.floor((relativeX - LEFT_MARGIN) / (GATE_SIZE + 4));
        const row = Math.floor((relativeY - TOP_MARGIN) / WIRE_SPACING);

        const gateDefinition = GATES.find((g) => g.type === draggedGate.gate);
        const gateHeight = gateDefinition?.height || 1;
        const currentCircuit = circuitRef.current;

        const isValid = col >= 0 && row >= 0 && row + gateHeight <= currentCircuit.qubitCount;

        setPreviewPosition({
            col: Math.max(0, col),
            row: Math.max(0, row),
            isValid,
        });
    }, [draggedGate]);

    const handleMouseUp = useCallback(() => {
        if (!draggedGate || !previewPosition || !previewPosition.isValid) {
            setDraggedGate(null);
            setPreviewPosition(null);
            return;
        }

        const gateDefinition = GATES.find((g) => g.type === draggedGate.gate);
        if (!gateDefinition) {
            setDraggedGate(null);
            setPreviewPosition(null);
            return;
        }

        setCircuit((prev) => {
            const newColumns = [...prev.columns];
            const gateHeight = gateDefinition.height || 1;

            if (previewPosition.row + gateHeight > prev.qubitCount) {
                return prev;
            }

            while (newColumns.length <= previewPosition.col) {
                newColumns.push({ gates: Array(prev.qubitCount).fill(null) });
            }

            const targetColumn = newColumns[previewPosition.col];
            const newGates = [...targetColumn.gates];

            for (let i = 0; i < gateHeight; i++) {
                if (newGates[previewPosition.row + i] !== null) {
                    return prev;
                }
            }

            const newGate: Gate = {
                ...gateDefinition,
                id: `${draggedGate.gate}-${Date.now()}-${Math.random()}`,
            };

            newGates[previewPosition.row] = newGate;

            for (let i = 1; i < gateHeight; i++) {
                if (previewPosition.row + i < newGates.length) {
                    newGates[previewPosition.row + i] = {
                        type: 'OCCUPIED',
                        id: `${newGate.id}-occupied-${i}`,
                        label: '',
                    } as Gate;
                }
            }

            newColumns[previewPosition.col] = { gates: newGates };
            return trimCircuit({ ...prev, columns: newColumns });
        });

        setDraggedGate(null);
        setPreviewPosition(null);
    }, [draggedGate, previewPosition, setCircuit]);

    // Copy handler
    const handleCopy = useCallback(() => {
        const selected = selectedGateRef.current;
        const currentCircuit = circuitRef.current;

        if (!selected || !currentCircuit) return;

        const { col, row } = selected;
        const gate = currentCircuit.columns[col]?.gates[row];

        if (gate && gate.type !== 'OCCUPIED') {
            const clonedGate = JSON.parse(JSON.stringify(gate));
            setCopiedGate(clonedGate);
        }
    }, []);

    // Paste handler - always paste at end of circuit
    const handlePaste = useCallback(() => {
        const copied = copiedGateRef.current;
        const currentCircuit = circuitRef.current;

        if (!copied) return;

        const col = currentCircuit.columns.length;
        const row = 0;

        setCircuit((prev) => {
            const newColumns = [...prev.columns];

            while (newColumns.length <= col) {
                newColumns.push({ gates: Array(prev.qubitCount).fill(null) });
            }

            const gateHeight = copied.height || 1;
            if (row + gateHeight > prev.qubitCount) {
                return prev;
            }

            const newGates = [...newColumns[col].gates];

            const newGate: Gate = {
                ...copied,
                id: `${copied.type}-${Date.now()}-${Math.random()}`,
                nestedCircuit: copied.nestedCircuit
                    ? JSON.parse(JSON.stringify(copied.nestedCircuit))
                    : undefined,
            };

            newGates[row] = newGate;

            for (let i = 1; i < gateHeight; i++) {
                newGates[row + i] = {
                    type: 'OCCUPIED',
                    id: `${newGate.id}_occupied_${i}`,
                    label: '',
                    height: 1,
                };
            }

            newColumns[col] = { gates: newGates };
            return { ...prev, columns: newColumns };
        });
    }, [setCircuit]);

    // Delete handler
    const handleDelete = useCallback(() => {
        const selected = selectedGateRef.current;
        if (!selected) return;

        const { col, row } = selected;

        setCircuit((prev) => {
            const gate = prev.columns[col]?.gates[row];
            if (!gate || gate.type === 'OCCUPIED') return prev;

            const newColumns = [...prev.columns];
            const newGates = [...newColumns[col].gates];

            const gateHeight = gate.height || 1;
            newGates[row] = null;
            for (let i = 1; i < gateHeight; i++) {
                if (row + i < prev.qubitCount) {
                    newGates[row + i] = null;
                }
            }

            newColumns[col] = { gates: newGates };
            return { ...prev, columns: newColumns };
        });

        setSelectedGate(null);
    }, [setCircuit]);

    // Gate resize handler
    const handleGateResize = useCallback((col: number, row: number, newHeight: number) => {
        setCircuit((prev) => {
            const newColumns = [...prev.columns];
            if (newColumns[col]) {
                const newGates = [...newColumns[col].gates];
                const gateItem = newGates[row];
                if (gateItem && gateItem.canResize) {
                    newGates[row] = { ...gateItem, height: newHeight };
                    newColumns[col] = { gates: newGates };
                }
            }
            return { ...prev, columns: newColumns };
        });
    }, [setCircuit]);

    return {
        circuit,
        setCircuit,
        undo,
        redo,
        canUndo,
        canRedo,
        selectedGate,
        setSelectedGate,
        draggedGate,
        mousePos,
        previewPosition,
        handleDragStart,
        handleMouseMove,
        handleMouseUp,
        copiedGate,
        handleCopy,
        handlePaste,
        handleDelete,
        handleGateResize,
    };
}
