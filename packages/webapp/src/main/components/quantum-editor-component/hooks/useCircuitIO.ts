import React, { useRef, useEffect } from 'react';
import { Circuit, GateType } from '../types';
import { GATES } from '../constants';
import { downloadCircuitAsJSON, deserializeCircuit, trimCircuit } from '../utils';

interface UseCircuitIOOptions {
    setCircuit: (updater: Circuit | ((prev: Circuit) => Circuit)) => void;
}

interface UseCircuitIOReturn {
    fileInputRef: React.RefObject<HTMLInputElement>;
    handleExportJSON: () => void;
    handleImportJSON: () => void;
    handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Custom hook to handle circuit import/export operations
 */
export function useCircuitIO(
    circuit: Circuit,
    { setCircuit }: UseCircuitIOOptions
): UseCircuitIOReturn {
    const fileInputRef = useRef<HTMLInputElement>(null);

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
                console.error('Error parsing JSON:', error);
                alert('Failed to parse JSON file or invalid format.');
            }
        };
        reader.readAsText(file);
        // Reset input
        event.target.value = '';
    };

    return {
        fileInputRef,
        handleExportJSON,
        handleImportJSON,
        handleFileChange,
    };
}

/**
 * Custom hook to handle keyboard shortcuts for undo/redo
 */
export function useKeyboardShortcuts(
    undo: () => void,
    redo: () => void,
    canUndo: boolean,
    canRedo: boolean
) {
    useEffect(() => {
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
}
