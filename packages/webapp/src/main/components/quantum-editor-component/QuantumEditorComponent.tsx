import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Circuit, GateType } from './types';
import { GATES } from './constants';
import { GatePalette } from './GatePalette';
import { CircuitGrid } from './CircuitGrid';
import { Gate } from './Gate';
import { trimCircuit, downloadCircuitAsJSON, deserializeCircuit } from './utils';
import { TooltipProvider } from './Tooltip';
import {
    GATE_SIZE,
    WIRE_SPACING,
    TOP_MARGIN,
    LEFT_MARGIN,
    COLORS
} from './layout-constants';
import { useUndoRedo } from './useUndoRedo';

const EditorContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background-color: ${COLORS.BACKGROUND};
  font-family: sans-serif;
`;

const Toolbar = styled.div`
  padding: 10px;
  background-color: ${COLORS.TOOLBOX_BACKGROUND};
  border-bottom: 1px solid #aaa;
  display: flex;
  gap: 10px;
`;

const Workspace = styled.div`
  flex: 1;
  display: flex;
  overflow: hidden;
`;

const PaletteContainer = styled.div`
  width: 250px;
  background-color: ${COLORS.TOOLBOX_BACKGROUND};
  border-right: 1px solid #aaa;
  overflow-y: auto;
  padding: 10px;
`;

const CircuitContainer = styled.div`
  flex: 1;
  overflow: auto;
  padding: 20px;
  position: relative;
`;

export function QuantumEditorComponent(): JSX.Element {
    const {
        state: circuit,
        setState: setCircuit,
        undo,
        redo,
        canUndo,
        canRedo
    } = useUndoRedo<Circuit>({
        columns: [], // Start empty
        qubitCount: 5, // Default to 5 qubits
    });

    const [draggedGate, setDraggedGate] = useState<{ gate: GateType, offset: { x: number, y: number }, originalPos?: { col: number, row: number } } | null>(null);
    const [mousePos, setMousePos] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
    const circuitGridRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragStart = (gate: GateType, e: React.MouseEvent, originalPos?: { col: number, row: number }) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setDraggedGate({
            gate,
            offset: {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            },
            originalPos
        });
        setMousePos({ x: e.clientX, y: e.clientY });
        e.stopPropagation();
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (draggedGate) {
            setMousePos({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (draggedGate) {
            let droppedOnGrid = false;
            if (circuitGridRef.current) {
                const rect = circuitGridRef.current.getBoundingClientRect();
                const x = e.clientX - rect.left - LEFT_MARGIN;
                const y = e.clientY - rect.top - TOP_MARGIN;

                // Simple bounds check to see if we are roughly within the grid area
                // We allow dropping a bit outside the exact wires, but generally in the container
                if (x >= -GATE_SIZE && y >= -GATE_SIZE && x <= rect.width && y <= rect.height) {
                    const col = Math.floor((x + WIRE_SPACING / 2) / WIRE_SPACING);
                    const row = Math.floor((y + WIRE_SPACING / 2) / WIRE_SPACING);

                    // Allow dropping up to row 15 (16 wires total, 0-indexed)
                    if (col >= 0 && row >= 0 && row < 16) {
                        handleGateDrop(draggedGate.gate, col, row, draggedGate.originalPos);
                        droppedOnGrid = true;
                    }
                }
            }

            if (!droppedOnGrid && draggedGate.originalPos) {
                // Dropped outside grid and was an existing gate -> Delete
                handleGateDelete(draggedGate.originalPos);
            }

            setDraggedGate(null);
        }
    };

    const handleGateDelete = (pos: { col: number, row: number }) => {
        setCircuit(prev => {
            const newColumns = [...prev.columns];
            if (newColumns[pos.col]) {
                const newGates = [...newColumns[pos.col].gates];
                newGates[pos.row] = null;
                newColumns[pos.col] = { ...newColumns[pos.col], gates: newGates };
            }
            return trimCircuit({ ...prev, columns: newColumns });
        });
    };

    const handleGateDrop = (gateType: GateType, col: number, row: number, originalPos?: { col: number, row: number }) => {
        setCircuit(prev => {
            // Find the full gate definition from GATES
            const gateDefinition = GATES.find(g => g.type === gateType);
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
                    // Clear all rows occupied by the gate
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
                                ...Array(newWireCount - currentGates.length).fill(null)
                            ]
                        };
                    }
                }
            }

            // Helper function to check if a position range is available
            const isPositionAvailable = (targetCol: number, targetRow: number, height: number): boolean => {
                if (targetCol >= newColumns.length) return true; // Column doesn't exist yet

                for (let i = 0; i < height; i++) {
                    if (targetRow + i >= newWireCount) return false; // Out of bounds
                    if (newColumns[targetCol].gates[targetRow + i] !== null) {
                        return false; // Position occupied
                    }
                }
                return true;
            };

            // Calculate the last non-empty column index to implement clamping
            // This prevents creating large gaps by dropping gates far to the right
            let lastNonEmptyCol = -1;
            for (let i = newColumns.length - 1; i >= 0; i--) {
                if (!newColumns[i].gates.every(g => g === null)) {
                    lastNonEmptyCol = i;
                    break;
                }
            }

            // Clamp the target column to be at most one past the last non-empty column
            // We start at the requested 'col', but limit it.
            let targetCol = Math.min(col, lastNonEmptyCol + 1);

            // Ensure columns exist up to the target position
            while (newColumns.length <= targetCol) {
                newColumns.push({ gates: Array(newWireCount).fill(null) });
            }

            // Find the first available column for this gate starting from the clamped column
            // If the position is occupied, we push to the right (standard collision handling).
            while (!isPositionAvailable(targetCol, row, gateHeight)) {
                targetCol++; // Push to next column
                // Ensure the column exists
                while (newColumns.length <= targetCol) {
                    newColumns.push({ gates: Array(newWireCount).fill(null) });
                }
            }

            // Place the gate with full definition
            const newGates = [...newColumns[targetCol].gates];
            const newGate = {
                ...gateDefinition,
                id: Date.now().toString() // Unique ID for React keys
            };

            // For multi-wire gates, only place the gate at the top row
            // The Gate component will handle rendering across multiple rows
            newGates[row] = newGate;

            // Mark occupied rows as null (they're covered by the gate above)
            for (let i = 1; i < gateHeight; i++) {
                if (row + i < newWireCount) {
                    newGates[row + i] = {
                        type: 'OCCUPIED',
                        id: `${newGate.id}_occupied_${i}`,
                        label: '',
                        height: 1,
                        width: 1
                    };
                }
            }

            newColumns[targetCol] = { ...newColumns[targetCol], gates: newGates };

            // Apply trim (remove leading/trailing empty columns only)
            const updatedCircuit = { qubitCount: newWireCount, columns: newColumns };
            return trimCircuit(updatedCircuit);
        });
    };

    const handleGateResize = (col: number, row: number, newHeight: number) => {
        setCircuit(prev => {
            const newColumns = [...prev.columns];
            const gate = newColumns[col]?.gates[row];

            if (!gate || !gate.canResize) return prev;

            const oldHeight = gate.height || 1;
            const minHeight = gate.minHeight || 2;
            const maxHeight = gate.maxHeight || 16;

            // Clamp height to valid range
            const clampedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

            if (clampedHeight === oldHeight) return prev;

            // Ensure we have enough wires
            const requiredWires = row + clampedHeight;
            const newWireCount = Math.min(16, Math.max(prev.qubitCount, requiredWires));

            // Expand all columns if needed
            const expandedColumns = newColumns.map(col => ({
                gates: [
                    ...col.gates,
                    ...Array(Math.max(0, newWireCount - col.gates.length)).fill(null)
                ]
            }));

            // Update the gate with new height
            const newGates = [...expandedColumns[col].gates];

            // Clear old occupied rows
            for (let i = 0; i < oldHeight; i++) {
                newGates[row + i] = null;
            }

            // Place resized gate
            newGates[row] = { ...gate, height: clampedHeight };

            // Mark new occupied rows as null
            for (let i = 1; i < clampedHeight; i++) {
                if (row + i < newGates.length) {
                    newGates[row + i] = {
                        type: 'OCCUPIED',
                        id: `${gate.id}_occupied_${i}`,
                        label: '',
                        height: 1,
                        width: 1
                    };
                }
            }

            expandedColumns[col] = { gates: newGates };

            return {
                ...prev,
                qubitCount: newWireCount,
                columns: expandedColumns
            };
        });
    };

    const handleExportJSON = () => {
        downloadCircuitAsJSON(circuit);
    };

    const handleImportJSON = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;


        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const importedData = JSON.parse(content);

                const newCircuit = deserializeCircuit(importedData);
                setCircuit(trimCircuit(newCircuit));
            } catch (error) {
                console.error("Error parsing JSON:", error);
                alert("Failed to parse JSON file or invalid format.");
            }
        };
        reader.readAsText(file);
        // Reset input
        event.target.value = '';
    };

    // Add keyboard shortcuts for Undo/Redo
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                if (e.shiftKey) {
                    if (canRedo) redo();
                } else {
                    if (canUndo) undo();
                }
                e.preventDefault();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                if (canRedo) redo();
                e.preventDefault();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo, canUndo, canRedo]);

    return (
        <TooltipProvider>
            <DndProvider backend={HTML5Backend}>
                <EditorContainer onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
                    <Toolbar>
                        <h3>Quantum Editor</h3>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <button
                                onClick={undo}
                                disabled={!canUndo}
                                style={{
                                    padding: '5px 10px',
                                    cursor: canUndo ? 'pointer' : 'not-allowed',
                                    opacity: canUndo ? 1 : 0.5
                                }}
                            >
                                Undo
                            </button>
                            <button
                                onClick={redo}
                                disabled={!canRedo}
                                style={{
                                    padding: '5px 10px',
                                    cursor: canRedo ? 'pointer' : 'not-allowed',
                                    opacity: canRedo ? 1 : 0.5
                                }}
                            >
                                Redo
                            </button>
                        </div>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
                            <button
                                onClick={handleExportJSON}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#4CAF50',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                Export JSON
                            </button>
                            <button
                                onClick={handleImportJSON}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#2196F3',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                Import JSON
                            </button>
                            <input
                                type="file"
                                accept=".json"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                onChange={handleFileChange}
                            />
                        </div>
                    </Toolbar>
                    <Workspace>
                        <PaletteContainer>
                            <GatePalette onDragStart={handleDragStart} />
                        </PaletteContainer>
                        <CircuitContainer>
                            <CircuitGrid
                                ref={circuitGridRef}
                                circuit={circuit}
                                onGateDrop={() => { }} // Handled by global mouse up
                                draggedGate={draggedGate ? { ...draggedGate, x: mousePos.x, y: mousePos.y } : null}
                                onDragStart={handleDragStart}
                                onGateResize={handleGateResize}
                            />
                        </CircuitContainer>
                    </Workspace>
                    {draggedGate && (
                        <div style={{
                            position: 'fixed',
                            left: mousePos.x - draggedGate.offset.x,
                            top: mousePos.y - draggedGate.offset.y,
                            pointerEvents: 'none',
                            zIndex: 1000
                        }}>
                            <Gate gate={GATES.find(g => g.type === draggedGate.gate)!} isDragging />
                        </div>
                    )}
                </EditorContainer>
            </DndProvider>
        </TooltipProvider>
    );
}
