import { Circuit, CircuitColumn, Gate } from './types';
import { GATES } from './constants';

export function trimCircuit(circuit: Circuit): Circuit {
    const columns = circuit.columns;

    // Find first non-empty column
    let firstNonEmpty = 0;
    while (firstNonEmpty < columns.length && isColumnEmpty(columns[firstNonEmpty])) {
        firstNonEmpty++;
    }

    // If all empty, return empty circuit (but keep qubit count)
    if (firstNonEmpty === columns.length) {
        return {
            ...circuit,
            columns: []
        };
    }

    // Find last non-empty column
    let lastNonEmpty = columns.length - 1;
    while (lastNonEmpty >= 0 && isColumnEmpty(columns[lastNonEmpty])) {
        lastNonEmpty--;
    }

    // Slice the columns to keep only the range [firstNonEmpty, lastNonEmpty]
    // This removes leading empty columns (gravity to left) and trailing empty columns
    // But preserves internal empty columns (gaps)
    const newColumns = columns.slice(firstNonEmpty, lastNonEmpty + 1);

    return {
        ...circuit,
        columns: newColumns
    };
}

function isColumnEmpty(column: CircuitColumn): boolean {
    return column.gates.every(g => g === null);
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
                // Empty cell - use 1 (identity) in format
                col.push(1);
                row++;
                continue;
            }

            // Map gate type to symbol
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

/**
 * Deserializes Quirk's JSON format back into a Circuit
 * @param data The parsed JSON data from a Quirk file
 * @returns Reconstructed Circuit object
 */
export function deserializeCircuit(data: any): Circuit {
    if (!data || !data.cols || !Array.isArray(data.cols)) {
        throw new Error("Invalid Quirk JSON format: missing 'cols' array");
    }

    const cols = data.cols;
    const columns: CircuitColumn[] = [];
    let maxWires = 0;

    // First pass: determine the number of wires (qubits)
    cols.forEach((col: any[]) => {
        if (Array.isArray(col)) {
            maxWires = Math.max(maxWires, col.length);
        }
    });

    // Ensure at least 5 qubits or enough to fit the circuit
    const qubitCount = Math.max(5, maxWires);

    // Second pass: reconstruct columns and gates
    cols.forEach((colData: any[]) => {
        const gates: (Gate | null)[] = Array(qubitCount).fill(null);

        if (Array.isArray(colData)) {
            for (let row = 0; row < colData.length; row++) {
                const symbol = colData[row];

                // Skip empty cells (1)
                if (symbol === 1) continue;

                const gate = mapQuirkSymbolToGate(symbol);
                if (gate) {
                    // Assign a unique ID for React
                    gate.id = `${gate.type}-${Date.now()}-${Math.random()}`;

                    gates[row] = gate;

                    // Handle multi-wire gates (occupy subsequent rows)
                    if (gate.height && gate.height > 1) {
                        for (let i = 1; i < gate.height; i++) {
                            if (row + i < qubitCount) {
                                gates[row + i] = {
                                    type: 'OCCUPIED',
                                    id: `${gate.id}_occupied_${i}`,
                                    label: '',
                                    height: 1,
                                    width: 1
                                };
                            }
                        }
                    }
                }
            }
        }

        columns.push({ gates });
    });

    return {
        columns,
        qubitCount
    };
}

/**
 * Maps a Quirk symbol to a Gate object
 */
function mapQuirkSymbolToGate(symbol: string | number): Gate | null {
    if (symbol === 1) return null;

    // Handle Control Gates
    if (symbol === '•') {
        const controlGate = GATES.find(g => g.type === 'CONTROL');
        return controlGate ? { ...controlGate } : null;
    }
    if (symbol === '◦') {
        const antiControlGate = GATES.find(g => g.type === 'ANTI_CONTROL');
        return antiControlGate ? { ...antiControlGate } : null;
    }

    // Handle Multi-wire gates (<<N)
    if (typeof symbol === 'string' && symbol.startsWith('<<')) {
        const height = parseInt(symbol.substring(2), 10);
        // Default to Interleave, but could be Deinterleave. 
        const interleaveGate = GATES.find(g => g.type === 'INTERLEAVE');
        return interleaveGate ? { ...interleaveGate, height } : null;
    }

    // Handle Standard Gates
    // We need a reverse map or search
    // Our export map was:
    // 'H': 'H', 'X': 'X', ...

    // Try to find by symbol match first
    let match = GATES.find(g => g.symbol === symbol);
    if (match) return { ...match };

    // Try to find by label match
    match = GATES.find(g => g.label === symbol);
    if (match) return { ...match };

    // Special cases for symbols that don't match exactly or are mapped differently
    const reverseMap: Record<string, string> = {
        'Z^½': 'S',
        'Z^-½': 'S_DAG',
        'Z^¼': 'T',
        'Z^-¼': 'T_DAG',
        'X^½': 'V',
        'X^-½': 'V_DAG',
        'Y^½': 'SQRT_Y',
        'Y^-½': 'SQRT_Y_DAG',
        'Measure': 'MEASURE',
        'Swap': 'SWAP',
        'QFT': 'QFT',
        'QFT†': 'QFT_DAG',
        '|0⟩⟨0|': 'POST_SELECT_OFF',
        '|1⟩⟨1|': 'POST_SELECT_ON',
        'Bloch': 'BLOCH',
        'Density': 'DENSITY',
        'Chance': 'PROB', // or CHANCE
        'Amps': 'AMPLITUDE',
        '+=1': 'INC',
        '-=1': 'DEC',
        '+=A': 'ADD',
        '-=A': 'SUB',
        '*=A': 'MUL',
        // Add others as needed
    };

    if (typeof symbol === 'string' && reverseMap[symbol]) {
        const type = reverseMap[symbol];
        match = GATES.find(g => g.type === type);
        if (match) return { ...match };
    }

    // Fallback: Create a generic gate with the symbol
    return {
        type: 'MYSTERY', // Use Mystery gate for unknown symbols
        id: 'unknown',
        label: symbol.toString(),
        symbol: symbol.toString(),
        description: 'Unknown Gate',
        isControl: false,
        width: 1,
        height: 1
    };
}
