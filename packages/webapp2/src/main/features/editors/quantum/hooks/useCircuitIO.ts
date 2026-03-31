import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Circuit, Gate, GateType } from '../types';
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
 * Custom hook to handle keyboard shortcuts for undo/redo and copy/paste
 */
export function useKeyboardShortcuts(
    undo: () => void,
    redo: () => void,
    canUndo: boolean,
    canRedo: boolean,
    copyPasteOptions?: {
        circuit: Circuit;
        setCircuit: (updater: Circuit | ((prev: Circuit) => Circuit)) => void;
        selectedGate: { col: number; row: number } | null;
        setSelectedGate: (gate: { col: number; row: number } | null) => void;
    }
) {
    // Store copied gate in state
    const [copiedGate, setCopiedGate] = useState<Gate | null>(null);
    
    // Use refs to get latest values without re-creating callbacks
    const circuitRef = useRef(copyPasteOptions?.circuit);
    const selectedGateRef = useRef(copyPasteOptions?.selectedGate);
    const setCircuitRef = useRef(copyPasteOptions?.setCircuit);
    const setSelectedGateRef = useRef(copyPasteOptions?.setSelectedGate);
    const copiedGateRef = useRef(copiedGate);
    
    // Keep refs up to date
    useEffect(() => {
        circuitRef.current = copyPasteOptions?.circuit;
        selectedGateRef.current = copyPasteOptions?.selectedGate;
        setCircuitRef.current = copyPasteOptions?.setCircuit;
        setSelectedGateRef.current = copyPasteOptions?.setSelectedGate;
    }, [copyPasteOptions?.circuit, copyPasteOptions?.selectedGate, copyPasteOptions?.setCircuit, copyPasteOptions?.setSelectedGate]);
    
    useEffect(() => {
        copiedGateRef.current = copiedGate;
    }, [copiedGate]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Undo: Ctrl+Z
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                if (e.shiftKey) {
                    if (canRedo) redo();
                } else {
                    if (canUndo) undo();
                }
                e.preventDefault();
                return;
            } 
            // Redo: Ctrl+Y
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                if (canRedo) redo();
                e.preventDefault();
                return;
            }
            // Copy: Ctrl+C
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                const circuit = circuitRef.current;
                const selectedGate = selectedGateRef.current;
                
                if (!selectedGate || !circuit) {
                    return;
                }
                
                const { col, row } = selectedGate;
                const gate = circuit.columns[col]?.gates[row];
                
                if (gate && gate.type !== 'OCCUPIED') {
                    const clonedGate = JSON.parse(JSON.stringify(gate));
                    setCopiedGate(clonedGate);
                }
                e.preventDefault();
                return;
            }
            // Paste: Ctrl+V - always paste at end of circuit
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                const copiedGate = copiedGateRef.current;
                const setCircuit = setCircuitRef.current;
                const circuit = circuitRef.current;
                
                if (!copiedGate || !setCircuit) {
                    return;
                }
                
                // Always paste at the end of the circuit on row 0
                const col = circuit?.columns.length || 0;
                const row = 0;
                
                setCircuit((prev: Circuit) => {
                    const newColumns = [...prev.columns];
                    
                    // Ensure the column exists
                    while (newColumns.length <= col) {
                        newColumns.push({ gates: Array(prev.qubitCount).fill(null) });
                    }
                    
                    // Check if there's enough space for multi-qubit gates
                    const gateHeight = copiedGate.height || 1;
                    if (row + gateHeight > prev.qubitCount) {
                        return prev;
                    }
                    
                    // Check if target positions are empty (or we're replacing existing)
                    for (let i = 1; i < gateHeight; i++) {
                        const existingGate = newColumns[col]?.gates[row + i];
                        if (existingGate && existingGate.type !== 'OCCUPIED') {
                            return prev;
                        }
                    }
                    
                    const newGates = [...newColumns[col].gates];
                    
                    // Create a new gate with a unique ID
                    const newGate: Gate = {
                        ...copiedGate,
                        id: `${copiedGate.type}-${Date.now()}-${Math.random()}`,
                        nestedCircuit: copiedGate.nestedCircuit 
                            ? JSON.parse(JSON.stringify(copiedGate.nestedCircuit))
                            : undefined,
                    };
                    
                    // Place the gate
                    newGates[row] = newGate;
                    
                    // Mark occupied rows for multi-qubit gates
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
                e.preventDefault();
                return;
            }
            // Delete: Delete or Backspace
            if (e.key === 'Delete' || e.key === 'Backspace') {
                const target = e.target as HTMLElement;
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                    return; // Don't interfere with text inputs
                }
                
                const selectedGate = selectedGateRef.current;
                const setCircuit = setCircuitRef.current;
                const setSelectedGate = setSelectedGateRef.current;
                
                if (!selectedGate || !setCircuit) return;
                
                const { col, row } = selectedGate;
                
                setCircuit((prev: Circuit) => {
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
                
                if (setSelectedGate) {
                    setSelectedGate(null);
                }
                e.preventDefault();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo, canUndo, canRedo]);

    return { copiedGate };
}
