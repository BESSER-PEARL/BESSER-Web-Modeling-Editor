import { useCallback } from 'react';
import { Circuit } from '../types';
import { trimCircuit } from '../utils';

interface UseGateResizeOptions {
    setCircuit: (updater: (prev: Circuit) => Circuit) => void;
}

/**
 * Custom hook to handle gate resize operations
 */
export function useGateResize({ setCircuit }: UseGateResizeOptions) {
    const handleGateResize = useCallback(
        (col: number, row: number, newHeight: number) => {
            setCircuit((prev) => {
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
                const expandedColumns = newColumns.map((col) => ({
                    gates: [
                        ...col.gates,
                        ...Array(Math.max(0, newWireCount - col.gates.length)).fill(null),
                    ],
                }));

                // Update the gate with new height
                const newGates = [...expandedColumns[col].gates];

                // Clear old occupied rows
                for (let i = 0; i < oldHeight; i++) {
                    newGates[row + i] = null;
                }

                // Place resized gate
                newGates[row] = { ...gate, height: clampedHeight };

                // Mark new occupied rows
                for (let i = 1; i < clampedHeight; i++) {
                    if (row + i < newGates.length) {
                        newGates[row + i] = {
                            type: 'OCCUPIED',
                            id: `${gate.id}_occupied_${i}`,
                            label: '',
                            height: 1,
                            width: 1,
                        };
                    }
                }

                expandedColumns[col] = { gates: newGates };

                return {
                    ...prev,
                    qubitCount: newWireCount,
                    columns: expandedColumns,
                };
            });
        },
        [setCircuit]
    );

    return { handleGateResize };
}
