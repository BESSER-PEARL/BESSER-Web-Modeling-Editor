import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { GATES } from './constants';
import { Circuit, InitialState } from './types';
import { trimCircuit } from './utils';
import { GatePalette, CircuitGrid, Gate, TooltipProvider, EditorToolbar, NestedCircuitModal } from './components';
import {
    useUndoRedo,
    useCircuitPersistence,
    useAutoSave,
    useCircuitDragDrop,
    useGateResize,
    useCircuitIO,
    useKeyboardShortcuts,
} from './hooks';
import {
    EditorContainer,
    Workspace,
    PaletteContainer,
    CircuitContainer,
    DragGhost,
} from './styles';

/**
 * Main Quantum Circuit Editor Component
 * 
 * This component provides a visual drag-and-drop interface for building
 * quantum circuits. It uses several custom hooks to separate concerns:
 * 
 * - useCircuitPersistence: Handles loading/saving to project storage
 * - useAutoSave: Manages debounced and periodic auto-saving
 * - useCircuitDragDrop: Handles all drag and drop interactions
 * - useGateResize: Handles resizable gate operations
 * - useCircuitIO: Handles import/export to JSON files
 * - useUndoRedo: Provides undo/redo functionality
 */
export function QuantumEditorComponent(): JSX.Element {
    const circuitGridRef = useRef<HTMLDivElement>(null);

    // Persistence
    const { saveStatus, saveCircuit, loadCircuit } = useCircuitPersistence();

    // Load initial circuit only once using useMemo
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const initialCircuit = useMemo(() => {
        //console.log('[QuantumEditor] Loading initial circuit (only once)');
        return loadCircuit();
    }, []); // Empty deps - only run once on mount

    // Circuit state with undo/redo
    const {
        state: circuit,
        setState: setCircuit,
        undo,
        redo,
        canUndo,
        canRedo,
    } = useUndoRedo(initialCircuit);

    // Auto-save
    useAutoSave(circuit, saveCircuit);

    // Drag and drop
    const {
        draggedGate,
        mousePos,
        previewPosition,
        handleDragStart,
        handleMouseMove,
        handleMouseUp,
    } = useCircuitDragDrop({
        circuit,
        setCircuit,
        circuitGridRef,
    });

    // Gate resize
    const { handleGateResize } = useGateResize({ setCircuit });

    // Import/Export
    const {
        fileInputRef,
        handleExportJSON,
        handleImportJSON,
        handleFileChange,
    } = useCircuitIO(circuit, { setCircuit });

    // Keyboard shortcuts
    useKeyboardShortcuts(undo, redo, canUndo, canRedo);

    // Selected gate state
    const [selectedGate, setSelectedGate] = useState<{ col: number; row: number } | null>(null);

    // Modal state for editing nested circuits
    const [nestedCircuitModal, setNestedCircuitModal] = useState<{ col: number; row: number } | null>(null);

    // Handle gate selection
    const handleGateSelect = useCallback((col: number, row: number) => {
        if (col === -1 && row === -1) {
            setSelectedGate(null); // Deselect
        } else {
            setSelectedGate({ col, row });
        }
    }, []);

    // Handle gate double-click to open nested circuit editor
    const handleGateDoubleClick = useCallback((col: number, row: number) => {
        //console.log('[QuantumEditor] Double-clicked gate at col:', col, 'row:', row);

        // ALWAYS reload from storage to get the latest saved data
        //console.log('[QuantumEditor] Reloading circuit from storage to ensure we have latest data...');
        const reloadedCircuit = loadCircuit();
        //console.log('[QuantumEditor] Reloaded circuit:', reloadedCircuit);

        // Update the circuit state with reloaded data
        setCircuit(() => reloadedCircuit);

        // Get the gate from reloaded circuit
        const gate = reloadedCircuit.columns[col]?.gates[row];
        //console.log('[QuantumEditor] Gate from reloaded circuit:', gate);
        //console.log('[QuantumEditor] Gate nestedCircuit:', gate?.nestedCircuit);
        //console.log('[QuantumEditor] Gate label:', gate?.label);

        if (gate?.isFunctionGate) {
            setNestedCircuitModal({ col, row });
        }
    }, [loadCircuit, setCircuit]);

    // Handle saving nested circuit
    const handleSaveNestedCircuit = useCallback((col: number, row: number, nestedCircuit: Circuit, name?: string) => {
        //console.log('[QuantumEditor] handleSaveNestedCircuit called!');
        //console.log('[QuantumEditor] Saving nested circuit at col:', col, 'row:', row);
        //console.log('[QuantumEditor] Nested circuit to save:', JSON.stringify(nestedCircuit));
        //console.log('[QuantumEditor] Gate name:', name);

        setCircuit((prev) => {
            //console.log('[QuantumEditor] Previous circuit columns:', prev.columns);
            const newColumns = [...prev.columns];
            const gate = newColumns[col]?.gates[row];
            //console.log('[QuantumEditor] Current gate before update:', gate);
            //console.log('[QuantumEditor] Gate isFunctionGate:', gate?.isFunctionGate);

            if (gate && gate.isFunctionGate) {
                const newGates = [...newColumns[col].gates];
                const updatedGate = {
                    ...gate,
                    nestedCircuit,
                    label: name || gate.label // Update label if name provided
                };
                newGates[row] = updatedGate;
                newColumns[col] = { ...newColumns[col], gates: newGates };
                //console.log('[QuantumEditor] Updated gate with nestedCircuit:', updatedGate);
                //console.log('[QuantumEditor] Updated gate nestedCircuit defined?', !!updatedGate.nestedCircuit);
                const updated = { ...prev, columns: newColumns };
                //console.log('[QuantumEditor] Updated circuit to return:', updated);

                // Use setTimeout to ensure React has flushed the state update before saving
                // We pass the updated circuit directly, not relying on closure
                setTimeout(() => {
                    //console.log('[QuantumEditor] Force saving updated circuit with nested circuit');
                    saveCircuit(updated);
                }, 100); // Small delay to ensure state is flushed

                return updated;
            }
            console.warn('[QuantumEditor] Gate not found or not a function gate');
            console.warn('[QuantumEditor] Gate:', gate);
            console.warn('[QuantumEditor] gate.isFunctionGate:', gate?.isFunctionGate);
            return prev;
        });
    }, [setCircuit, saveCircuit]);

    // Initial state cycling
    const INITIAL_STATES: InitialState[] = ['|0⟩', '|1⟩', '|+⟩', '|−⟩', '|i⟩', '|−i⟩'];

    const handleInitialStateChange = useCallback((row: number) => {
        setCircuit((prev) => {
            // Initialize initialStates array if it doesn't exist
            const currentStates = prev.initialStates || Array(prev.qubitCount).fill('|0⟩');
            const currentState = currentStates[row] || '|0⟩';

            // Find current state index and cycle to next
            const currentIndex = INITIAL_STATES.indexOf(currentState as InitialState);
            const nextIndex = (currentIndex + 1) % INITIAL_STATES.length;
            const newState = INITIAL_STATES[nextIndex];

            // Create new array with updated state
            const newStates = [...currentStates];
            newStates[row] = newState;

            return {
                ...prev,
                initialStates: newStates,
            };
        });
    }, [setCircuit]);

    // Handle Delete/Backspace key to delete selected gate
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedGate) {
                // Don't delete if focus is on an input field
                if ((e.target as HTMLElement).tagName === 'INPUT' ||
                    (e.target as HTMLElement).tagName === 'TEXTAREA') {
                    return;
                }

                e.preventDefault();

                // Delete the selected gate
                setCircuit((prev) => {
                    const newColumns = [...prev.columns];
                    if (newColumns[selectedGate.col]) {
                        const newGates = [...newColumns[selectedGate.col].gates];
                        const gate = newGates[selectedGate.row];
                        if (gate) {
                            const gateHeight = gate.height || 1;
                            // Remove the gate and any OCCUPIED cells
                            for (let i = 0; i < gateHeight; i++) {
                                if (selectedGate.row + i < newGates.length) {
                                    newGates[selectedGate.row + i] = null;
                                }
                            }
                            newColumns[selectedGate.col] = { ...newColumns[selectedGate.col], gates: newGates };
                        }
                    }
                    return trimCircuit({ ...prev, columns: newColumns });
                });

                setSelectedGate(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedGate, setCircuit]);

    // Manual save handler
    const handleManualSave = () => {
        //console.log('[QuantumEditor] Manual save triggered');
        saveCircuit(circuit);
    };

    // Load example circuit handler
    const handleLoadCircuit = useCallback((newCircuit: Circuit) => {
        setCircuit(() => newCircuit);
    }, [setCircuit]);

    return (
        <TooltipProvider>
            <DndProvider backend={HTML5Backend}>
                <EditorContainer onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
                    {/* <EditorToolbar
                        saveStatus={saveStatus}
                        canUndo={canUndo}
                        canRedo={canRedo}
                        onUndo={undo}
                        onRedo={redo}
                        onSave={handleManualSave}
                        onExport={handleExportJSON}
                        onImport={handleImportJSON}
                        onLoadCircuit={handleLoadCircuit}
                    /> */}
                    <input
                        type="file"
                        accept=".json"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                    />
                    <Workspace>
                        <PaletteContainer>
                            <GatePalette onDragStart={handleDragStart} />
                        </PaletteContainer>
                        <CircuitContainer>
                            <CircuitGrid
                                ref={circuitGridRef}
                                circuit={circuit}
                                onGateDrop={() => { }} // Handled by global mouse up
                                draggedGate={
                                    draggedGate
                                        ? { ...draggedGate, x: mousePos.x, y: mousePos.y }
                                        : null
                                }
                                onDragStart={handleDragStart}
                                onGateResize={handleGateResize}
                                onGateDoubleClick={handleGateDoubleClick}
                                previewPosition={previewPosition}
                                selectedGate={selectedGate}
                                onGateSelect={handleGateSelect}
                                onInitialStateChange={handleInitialStateChange}
                            />
                        </CircuitContainer>
                    </Workspace>
                    {draggedGate && (
                        <DragGhost
                            $x={mousePos.x}
                            $y={mousePos.y}
                            $offsetX={draggedGate.offset.x}
                            $offsetY={draggedGate.offset.y}
                        >
                            <Gate gate={GATES.find((g) => g.type === draggedGate.gate)!} isDragging />
                        </DragGhost>
                    )}
                    {nestedCircuitModal && (
                        <NestedCircuitModal
                            key={`${nestedCircuitModal.col}-${nestedCircuitModal.row}`}
                            gate={circuit.columns[nestedCircuitModal.col]?.gates[nestedCircuitModal.row]!}
                            onClose={() => setNestedCircuitModal(null)}
                            onSave={(nestedCircuit: Circuit, name?: string) => {
                                handleSaveNestedCircuit(nestedCircuitModal.col, nestedCircuitModal.row, nestedCircuit, name);
                                setNestedCircuitModal(null);
                            }}
                        />
                    )}
                </EditorContainer>
            </DndProvider>
        </TooltipProvider>
    );
}
