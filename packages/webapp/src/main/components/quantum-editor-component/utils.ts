import { Circuit, CircuitColumn, Gate } from './types';

export function compactCircuit(circuit: Circuit): Circuit {
    const qubitCount = circuit.qubitCount;

    // 1. Get all gates with their current (col, row)
    // Filter out OCCUPIED gates as they are just placeholders
    type GateWithPos = { gate: Gate, col: number, row: number };
    const allGates: GateWithPos[] = [];

    circuit.columns.forEach((col, colIndex) => {
        col.gates.forEach((gate, rowIndex) => {
            if (gate && gate.type !== 'OCCUPIED') {
                allGates.push({ gate, col: colIndex, row: rowIndex });
            }
        });
    });

    // 2. Sort by column to preserve relative order
    allGates.sort((a, b) => a.col - b.col);

    // 3. Place into new columns
    const finalColumns: CircuitColumn[] = [];

    const getGateAt = (col: number, row: number) => {
        if (!finalColumns[col]) return null;
        return finalColumns[col].gates[row];
    };

    const setGateAt = (col: number, row: number, gate: Gate) => {
        while (finalColumns.length <= col) {
            finalColumns.push({ gates: Array(qubitCount).fill(null) });
        }
        finalColumns[col].gates[row] = gate;

        // Mark occupied rows for multi-wire gates
        const gateHeight = gate.height || 1;
        for (let i = 1; i < gateHeight; i++) {
            if (row + i < qubitCount) {
                // Use a special OCCUPIED gate placeholder
                finalColumns[col].gates[row + i] = {
                    type: 'OCCUPIED',
                    id: `${gate.id}_occupied_${i}`,
                    label: '',
                    height: 1,
                    width: 1
                };
            }
        }
    };

    const isPositionAvailable = (col: number, row: number, height: number) => {
        if (!finalColumns[col]) return true; // Column doesn't exist yet

        // Check if all rows needed by this gate are free
        for (let i = 0; i < height; i++) {
            if (row + i >= qubitCount) return false; // Out of bounds
            if (finalColumns[col].gates[row + i] !== null) {
                return false; // Position occupied
            }
        }
        return true;
    };

    allGates.forEach(({ gate, row }) => {
        const gateHeight = gate.height || 1;
        let targetCol = 0;

        // Find first column where ALL rows needed by this gate are free
        while (!isPositionAvailable(targetCol, row, gateHeight)) {
            targetCol++;
        }
        setGateAt(targetCol, row, gate);
    });

    return {
        ...circuit,
        columns: finalColumns
    };
}

/**
 * Serializes the circuit to Quirk's JSON format
 * @param circuit The circuit to serialize
 * @returns Quirk-compatible JSON object
 */
export function serializeCircuit(circuit: Circuit): any {
    const cols: any[] = [];

    for (const column of circuit.columns) {
        const col: any[] = [];
        let row = 0;

        while (row < column.gates.length) {
            const gate = column.gates[row];

            if (!gate) {
                // Empty cell - use 1 (identity) in Quirk format
                col.push(1);
                row++;
                continue;
            }

            // Map gate type to Quirk symbol
            let symbol: string | number = mapGateToQuirkSymbol(gate);
            col.push(symbol);

            // For multi-wire gates, skip the occupied rows (they're null in our format)
            const gateHeight = gate.height || 1;
            row++; // Move past the gate itself

            // Skip the null entries that mark occupied rows
            for (let i = 1; i < gateHeight; i++) {
                row++; // Skip occupied row
            }
        }

        cols.push(col);
    }

    return {
        cols,
        gates: [] // Custom gates would go here
    };
}

/**
 * Maps our internal gate type to Quirk's gate symbol
 */
function mapGateToQuirkSymbol(gate: any): string | number {
    // Control gates
    if (gate.isControl) {
        return gate.type === 'ANTI_CONTROL' ? '◦' : '•';
    }

    // Interleave/Deinterleave gates use <<N notation where N is the height
    if (gate.type === 'INTERLEAVE' || gate.type === 'DEINTERLEAVE') {
        const height = gate.height || 2;
        return `<<${height}`;
    }

    // OCCUPIED gates should be treated as identity (1) if encountered
    if (gate.type === 'OCCUPIED') {
        return 1;
    }

    // Standard gates - map to Quirk symbols
    const typeMap: Record<string, string> = {
        'H': 'H',
        'X': 'X',
        'Y': 'Y',
        'Z': 'Z',
        'S': 'Z^½',
        'S_DAG': 'Z^-½',
        'T': 'Z^¼',
        'T_DAG': 'Z^-¼',
        'V': 'X^½',
        'V_DAG': 'X^-½',
        'SQRT_Y': 'Y^½',
        'SQRT_Y_DAG': 'Y^-½',
        'MEASURE': 'Measure',
        'SWAP': 'Swap',
        'QFT': 'QFT',
        'QFT_DAG': 'QFT†',
        'POST_SELECT_OFF': '|0⟩⟨0|',
        'POST_SELECT_ON': '|1⟩⟨1|',
        'BLOCH': 'Bloch',
        'DENSITY': 'Density',
        'PROB': 'Chance',
        'AMPLITUDE': 'Amps',
        'CHANCE': 'Chance',
        'INC': '+=1',
        'DEC': '-=1',
        'ADD': '+=A',
        'SUB': '-=A',
        'MUL': '*=A',
    };

    return typeMap[gate.type] || gate.label || gate.type;
}

/**
 * Downloads the circuit as a JSON file
 * @param circuit The circuit to export
 * @param filename The name of the file to download
 */
export function downloadCircuitAsJSON(circuit: Circuit, filename: string = 'quantum-circuit.json') {
    const data = serializeCircuit(circuit);
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
