import React, { useRef, useCallback } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { GATES } from './constants';
import { Circuit } from './types';
import { GatePalette, CircuitGrid, Gate, TooltipProvider, EditorToolbar } from './components';
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

    // Circuit state with undo/redo
    const {
        state: circuit,
        setState: setCircuit,
        undo,
        redo,
        canUndo,
        canRedo,
    } = useUndoRedo(loadCircuit());

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

    // Manual save handler
    const handleManualSave = () => {
        console.log('[QuantumEditor] Manual save triggered');
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
                    <EditorToolbar
                        saveStatus={saveStatus}
                        canUndo={canUndo}
                        canRedo={canRedo}
                        onUndo={undo}
                        onRedo={redo}
                        onSave={handleManualSave}
                        onExport={handleExportJSON}
                        onImport={handleImportJSON}
                        onLoadCircuit={handleLoadCircuit}
                    />
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
                                onGateDrop={() => {}} // Handled by global mouse up
                                draggedGate={
                                    draggedGate
                                        ? { ...draggedGate, x: mousePos.x, y: mousePos.y }
                                        : null
                                }
                                onDragStart={handleDragStart}
                                onGateResize={handleGateResize}
                                previewPosition={previewPosition}
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
                </EditorContainer>
            </DndProvider>
        </TooltipProvider>
    );
}
