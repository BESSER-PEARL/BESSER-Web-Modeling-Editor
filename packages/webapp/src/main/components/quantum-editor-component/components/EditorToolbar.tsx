import React from 'react';
import { SaveStatus as SaveStatusType } from '../hooks/useCircuitPersistence';
import {
    Toolbar,
    SaveStatus,
    UndoRedoButton,
    ToolbarButton,
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
}: EditorToolbarProps): JSX.Element {
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
