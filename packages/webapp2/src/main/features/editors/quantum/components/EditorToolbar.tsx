import React, { useState, useCallback } from 'react';
import { SaveStatus as SaveStatusType } from '../hooks/useCircuitPersistence';
import { Circuit } from '../types';
import { EXAMPLE_CIRCUITS, getCircuitsByCategory } from '../exampleCircuits';
import {
    Toolbar,
    SaveStatus,
    UndoRedoButton,
    ToolbarButton,
    DropdownContainer,
    DropdownButton,
    DropdownMenu,
    DropdownCategory,
    DropdownItem,
    DropdownItemTitle,
    DropdownItemDescription,
    DropdownOverlay,
} from '../styles';

interface EditorToolbarProps {
    saveStatus: SaveStatusType;
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onSave: () => void;
    onExport: () => void;
    onImport: () => void;
    onLoadCircuit?: (circuit: Circuit) => void;
}

/**
 * Toolbar component for the Quantum Editor
 */
export function EditorToolbar({
    saveStatus,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onSave,
    onExport,
    onImport,
    onLoadCircuit,
}: EditorToolbarProps): JSX.Element {
    const [examplesOpen, setExamplesOpen] = useState(false);
    const circuitsByCategory = getCircuitsByCategory();
    const categoryOrder = ['Basic', 'Algorithms', 'Protocols', 'Advanced'];

    const handleExampleSelect = useCallback((circuit: Circuit) => {
        if (onLoadCircuit) {
            // Deep clone the circuit to avoid mutations
            const clonedCircuit: Circuit = {
                qubitCount: circuit.qubitCount,
                columns: circuit.columns.map(col => ({
                    gates: col.gates.map(g => g ? { ...g, id: `${g.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` } : null)
                }))
            };
            onLoadCircuit(clonedCircuit);
        }
        setExamplesOpen(false);
    }, [onLoadCircuit]);

    return (
        <Toolbar>
            <h3>Quantum Editor</h3>
            <SaveStatus $status={saveStatus}>
                {saveStatus === 'saved' && '✓ Saved'}
                {saveStatus === 'saving' && '⟳ Saving...'}
                {saveStatus === 'error' && '⚠ Error'}
            </SaveStatus>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <UndoRedoButton onClick={onUndo} disabled={!canUndo} $disabled={!canUndo}>
                    Undo
                </UndoRedoButton>
                <UndoRedoButton onClick={onRedo} disabled={!canRedo} $disabled={!canRedo}>
                    Redo
                </UndoRedoButton>
            </div>
            
            {/* Examples Dropdown */}
            <DropdownContainer>
                <DropdownOverlay $isOpen={examplesOpen} onClick={() => setExamplesOpen(false)} />
                <DropdownButton 
                    onClick={() => setExamplesOpen(!examplesOpen)}
                    $isOpen={examplesOpen}
                >
                    📚 Examples
                </DropdownButton>
                <DropdownMenu $isOpen={examplesOpen}>
                    {categoryOrder.map(category => (
                        circuitsByCategory[category] && (
                            <React.Fragment key={category}>
                                <DropdownCategory>{category}</DropdownCategory>
                                {circuitsByCategory[category].map((example, idx) => (
                                    <DropdownItem
                                        key={`${category}-${idx}`}
                                        onClick={() => handleExampleSelect(example.circuit)}
                                    >
                                        <DropdownItemTitle>{example.name}</DropdownItemTitle>
                                        <DropdownItemDescription>{example.description}</DropdownItemDescription>
                                    </DropdownItem>
                                ))}
                            </React.Fragment>
                        )
                    ))}
                </DropdownMenu>
            </DropdownContainer>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
                <ToolbarButton
                    onClick={onSave}
                    $variant={saveStatus === 'saved' ? 'primary' : 'secondary'}
                    title="Manually save circuit to project"
                >
                    💾 Save Now
                </ToolbarButton>
                <ToolbarButton onClick={onExport} $variant="success">
                    Export JSON
                </ToolbarButton>
                <ToolbarButton onClick={onImport} $variant="info">
                    Import JSON
                </ToolbarButton>
            </div>
        </Toolbar>
    );
}
