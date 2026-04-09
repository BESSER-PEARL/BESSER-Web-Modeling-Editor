import React, { useRef, useCallback, CSSProperties } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Z_INDEX } from '../../../../shared/constants/z-index';
import { Circuit, InitialState } from '../types';
import { useCircuitEditor, CircuitEditorState } from '../hooks/useCircuitEditor';
import { useCircuitKeyboard } from '../hooks/useCircuitKeyboard';
import { CircuitGrid } from './CircuitGrid';
import { GatePalette } from './GatePalette';
import { Gate } from './Gate';
import { TooltipProvider } from './Tooltip';
import { GATES } from '../constants';

export interface CircuitEditorProps {
    // Option 1: Pass an external editor state (for advanced use with shared state)
    editor?: CircuitEditorState;
    // Option 2: Pass initial circuit and change handler (creates internal editor state)
    initialCircuit?: Circuit;
    onCircuitChange?: (circuit: Circuit) => void;
    // Common options
    isActive?: boolean;
    showToolbar?: boolean;
    compactPalette?: boolean;
    onInitialStateChange?: (row: number) => void;
    onGateDoubleClick?: (col: number, row: number) => void;
    keyboardCapturePhase?: boolean;
    style?: CSSProperties;
}

/**
 * Reusable circuit editor component.
 * Provides the full circuit editing UI with drag-and-drop, selection, and keyboard shortcuts.
 * 
 * Usage:
 * 1. Simple (self-contained): <CircuitEditor initialCircuit={...} onCircuitChange={...} />
 * 2. Advanced (shared state): <CircuitEditor editor={useCircuitEditor(...)} />
 */
export function CircuitEditor({
    editor: externalEditor,
    initialCircuit,
    onCircuitChange,
    isActive = true,
    showToolbar: _showToolbar = false,
    compactPalette = false,
    onInitialStateChange,
    onGateDoubleClick,
    keyboardCapturePhase = false,
    style,
}: CircuitEditorProps): JSX.Element {
    const circuitGridRef = useRef<HTMLDivElement>(null);

    // Create internal editor if no external one provided
    const internalEditor = useCircuitEditor({
        initialCircuit: initialCircuit || { columns: [], qubitCount: 2, initialStates: ['|0⟩', '|0⟩'] },
        onCircuitChange,
    });

    // Use external editor if provided, otherwise internal
    const editor = externalEditor || internalEditor;

    // Keyboard shortcuts
    useCircuitKeyboard({
        editor,
        isActive,
        capturePhase: keyboardCapturePhase,
    });

    // Handle mouse move for drag preview
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        editor.handleMouseMove(e, circuitGridRef);
    }, [editor]);

    // Handle gate selection
    const handleGateSelect = useCallback((col: number, row: number) => {
        if (col === -1 && row === -1) {
            editor.setSelectedGate(null);
        } else {
            editor.setSelectedGate({ col, row });
        }
    }, [editor]);

    // Handle initial state change
    const handleInitialStateChangeInternal = useCallback((row: number) => {
        if (onInitialStateChange) {
            onInitialStateChange(row);
        } else {
            // Default behavior
            editor.setCircuit((prev) => {
                const INITIAL_STATES: InitialState[] = ['|0⟩', '|1⟩', '|+⟩', '|−⟩', '|i⟩', '|−i⟩'];
                const currentStates = prev.initialStates || Array(prev.qubitCount).fill('|0⟩');
                const currentState = currentStates[row] || '|0⟩';
                const currentIndex = INITIAL_STATES.indexOf(currentState as InitialState);
                const nextIndex = (currentIndex + 1) % INITIAL_STATES.length;
                const newStates = [...currentStates];
                newStates[row] = INITIAL_STATES[nextIndex];
                return { ...prev, initialStates: newStates };
            });
        }
    }, [editor, onInitialStateChange]);

    return (
        <TooltipProvider>
            <DndProvider backend={HTML5Backend}>
                <div
                    className="flex flex-col h-full w-full bg-[var(--quantum-editor-bg,#ffffff)] text-[var(--quantum-editor-text,#0f172a)]"
                    style={style}
                    onMouseMove={handleMouseMove}
                    onMouseUp={editor.handleMouseUp}
                    onMouseLeave={editor.handleMouseUp}
                >
                    <div className="flex flex-1 overflow-hidden">
                        <div
                            className={`${compactPalette ? 'w-[220px] min-w-[200px]' : 'w-[280px] min-w-[250px]'} border-r border-[var(--quantum-editor-border,#d5dde8)] overflow-y-auto p-4 bg-[var(--quantum-editor-surface,#f8fafc)]`}
                        >
                            <GatePalette onDragStart={editor.handleDragStart} />
                        </div>
                        <div className="flex-1 overflow-auto p-5 relative bg-[var(--quantum-editor-bg,#ffffff)]">
                            <CircuitGrid
                                ref={circuitGridRef}
                                circuit={editor.circuit}
                                onGateDrop={() => {}}
                                draggedGate={editor.draggedGate ? {
                                    gate: editor.draggedGate.gate,
                                    x: editor.mousePos.x,
                                    y: editor.mousePos.y
                                } : null}
                                onDragStart={editor.handleDragStart}
                                onGateResize={editor.handleGateResize}
                                onGateSelect={handleGateSelect}
                                onGateDoubleClick={onGateDoubleClick}
                                onInitialStateChange={handleInitialStateChangeInternal}
                                selectedGate={editor.selectedGate}
                                previewPosition={editor.previewPosition}
                            />
                        </div>
                    </div>

                    {/* Drag ghost */}
                    {editor.draggedGate && (
                        <div
                            className="fixed pointer-events-none opacity-80"
                            style={{
                                zIndex: Z_INDEX.POPOVER,
                                left: editor.mousePos.x + (circuitGridRef.current?.getBoundingClientRect().left || 0),
                                top: editor.mousePos.y + (circuitGridRef.current?.getBoundingClientRect().top || 0),
                            }}
                        >
                            <Gate gate={GATES.find((g) => g.type === editor.draggedGate?.gate)!} isDragging />
                        </div>
                    )}
                </div>
            </DndProvider>
        </TooltipProvider>
    );
}
