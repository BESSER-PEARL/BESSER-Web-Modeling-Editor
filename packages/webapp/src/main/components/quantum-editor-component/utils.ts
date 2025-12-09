import { Circuit, CircuitColumn, Gate } from './types';
import { GATES } from './constants';

/**
 * Restores gate definitions from GATES constant to ensure drawer functions and other
 * properties are present after deserialization from JSON
 */
function restoreGateDefinition(gate: any): Gate {
    // Find the full gate definition from GATES
    const gateDefinition = GATES.find(g => g.type === gate.type);
    
    if (gateDefinition) {
        // Merge the serialized properties with the full definition
        return {
            ...gateDefinition,
            ...gate,
            // Ensure drawer comes from definition (can't be serialized)
            drawer: gateDefinition.drawer,
            // Preserve these from serialized gate if they exist
            id: gate.id,
            label: gate.label || gateDefinition.label,
            height: gate.height || gateDefinition.height,
            nestedCircuit: gate.nestedCircuit, // Will be restored recursively if needed
        };
    }
    
    // Fallback if gate type not found in GATES
    return gate;
}

/**
 * Recursively restores gate definitions in a circuit's nested circuits
 */
function restoreCircuitGateDefinitions(circuit: Circuit): Circuit {
    const restoredColumns = circuit.columns.map(column => ({
        gates: column.gates.map(gate => {
            if (!gate) return null;
            
            // Restore the gate definition
            const restoredGate = restoreGateDefinition(gate);
            
            // If gate has nested circuit, restore it recursively
            if (restoredGate.nestedCircuit) {
                restoredGate.nestedCircuit = restoreCircuitGateDefinitions(restoredGate.nestedCircuit);
            }
            
            return restoredGate;
        })
    }));
    
    return {
        ...circuit,
        columns: restoredColumns
    };
}

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
    console.log('[serializeCircuit] Starting serialization, circuit:', circuit);
    const cols: any[] = [];
    const gateMetadata: Record<string, any> = {}; // Store additional gate data

    for (let colIndex = 0; colIndex < circuit.columns.length; colIndex++) {
        const column = circuit.columns[colIndex];
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

            // Store metadata for ALL function gates, including nested circuits and custom labels
            if (gate.isFunctionGate || gate.nestedCircuit) {
                const metadataKey = `${colIndex}_${row}`;
                console.log(`[serializeCircuit] Storing metadata for gate at ${metadataKey}:`, {
                    type: gate.type,
                    label: gate.label,
                    isFunctionGate: gate.isFunctionGate,
                    hasNestedCircuit: !!gate.nestedCircuit,
                    nestedCircuit: gate.nestedCircuit,
                });
                gateMetadata[metadataKey] = {
                    nestedCircuit: gate.nestedCircuit,
                    label: gate.label,
                    type: gate.type,
                    isFunctionGate: gate.isFunctionGate,
                    height: gate.height,
                };
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

    const result = {
        cols,
        gates: [], // Custom gates would go here
        gateMetadata, // Store our additional metadata
        initialStates: circuit.initialStates, // Preserve initial states
    };
    console.log('[serializeCircuit] Serialization complete, result:', result);
    console.log('[serializeCircuit] gateMetadata:', gateMetadata);
    return result;
}

/**
 * Maps our internal gate type to Quirk's gate symbol
 */
function mapGateToQuirkSymbol(gate: any): string | number {
    // Control gates
    if (gate.isControl) {
        return gate.type === 'ANTI_CONTROL' ? '◦' : '•';
    }

    // Function gates - use a special prefix to ensure proper deserialization
    if (gate.isFunctionGate || gate.type === 'FUNCTION' || gate.type === 'ORACLE' || gate.type === 'UNITARY') {
        return `__FUNC__${gate.type}`;
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
    console.log('[deserializeCircuit] Starting deserialization, data:', data);
    if (!data || !data.cols || !Array.isArray(data.cols)) {
        throw new Error("Invalid Quirk JSON format: missing 'cols' array");
    }

    const cols = data.cols;
    const gateMetadata = data.gateMetadata || {};
    console.log('[deserializeCircuit] gateMetadata:', gateMetadata);
    const initialStates = data.initialStates;
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
    cols.forEach((colData: any[], colIndex: number) => {
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

                    // Restore metadata (nested circuits, custom labels, function gate flags)
                    const metadataKey = `${colIndex}_${row}`;
                    console.log(`[deserializeCircuit] Looking for metadata at ${metadataKey}`);
                    if (gateMetadata[metadataKey]) {
                        const metadata = gateMetadata[metadataKey];
                        console.log(`[deserializeCircuit] Found metadata:`, metadata);
                        if (metadata.nestedCircuit) {
                            // Restore gate definitions in nested circuit (including drawer functions)
                            gate.nestedCircuit = restoreCircuitGateDefinitions(metadata.nestedCircuit);
                            console.log(`[deserializeCircuit] Restored nestedCircuit for gate`);
                        }
                        if (metadata.label) {
                            gate.label = metadata.label;
                        }
                        if (metadata.isFunctionGate) {
                            gate.isFunctionGate = true;
                        }
                        if (metadata.height) {
                            gate.height = metadata.height;
                        }
                    }

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
        qubitCount,
        initialStates: initialStates || Array(qubitCount).fill('|0⟩'),
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

    // Handle Function Gates (with our special prefix)
    if (typeof symbol === 'string' && symbol.startsWith('__FUNC__')) {
        const gateType = symbol.substring(8); // Remove '__FUNC__' prefix
        console.log(`[mapQuirkSymbolToGate] Found function gate, type: ${gateType}`);
        const functionGate = GATES.find(g => g.type === gateType);
        if (functionGate) {
            return { ...functionGate, isFunctionGate: true };
        }
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
