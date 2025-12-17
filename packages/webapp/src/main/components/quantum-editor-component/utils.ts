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
            // Ensure isControl comes from definition (critical for control/anti-control rendering)
            isControl: gateDefinition.isControl,
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
    // Guard against undefined or invalid circuit structure
    if (!circuit || !circuit.columns || !Array.isArray(circuit.columns)) {
        return {
            columns: [],
            qubitCount: circuit?.qubitCount || 5
        };
    }

    const restoredColumns = circuit.columns.map(column => ({
        gates: (column?.gates || []).map(gate => {
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

    // Trim unused qubits (rows)
    const { columns: trimmedColumns, qubitCount: trimmedQubitCount } = trimUnusedQubits({
        ...circuit,
        columns: newColumns
    });

    return {
        ...circuit,
        columns: trimmedColumns,
        qubitCount: trimmedQubitCount,
        initialStates: circuit.initialStates?.slice(0, trimmedQubitCount) || Array(trimmedQubitCount).fill('|0⟩')
    };
}

function isColumnEmpty(column: CircuitColumn): boolean {
    return column.gates.every(g => g === null);
}

/**
 * Trims trailing empty qubit rows from the circuit
 */
function trimUnusedQubits(circuit: Circuit): { columns: CircuitColumn[]; qubitCount: number } {
    if (circuit.columns.length === 0) {
        return { columns: [], qubitCount: Math.max(3, circuit.qubitCount) }; // Keep minimum 3 qubits
    }

    // Find the last used qubit row across all columns
    // Must account for gate height (multi-qubit gates span multiple rows)
    let lastUsedQubit = 0;
    for (const column of circuit.columns) {
        for (let row = 0; row < column.gates.length; row++) {
            const gate = column.gates[row];
            if (gate && gate.type !== 'OCCUPIED') {
                // Calculate the last row this gate occupies based on its height
                const gateHeight = gate.height || 1;
                const gateEndRow = row + gateHeight - 1;
                lastUsedQubit = Math.max(lastUsedQubit, gateEndRow);
            }
        }
    }

    // Keep at least 1 qubit, or up to the last used qubit + 1
    const newQubitCount = Math.max(1, lastUsedQubit + 1);

    // If no trimming needed, return as-is
    if (newQubitCount >= circuit.qubitCount) {
        return { columns: circuit.columns, qubitCount: circuit.qubitCount };
    }

    // Trim each column to the new qubit count
    const trimmedColumns = circuit.columns.map(column => ({
        gates: column.gates.slice(0, newQubitCount)
    }));

    return { columns: trimmedColumns, qubitCount: newQubitCount };
}

/**
 * Serializes the circuit to Quirk's JSON format
 * @param circuit The circuit to serialize
 * @returns Quirk-compatible JSON object
 */
export function serializeCircuit(circuit: Circuit): any {
    //console.log('[serializeCircuit] Starting serialization, circuit:', circuit);
    const cols: any[] = [];
    const gateMetadata: Record<string, any> = {}; // Store additional gate data

    for (let colIndex = 0; colIndex < circuit.columns.length; colIndex++) {
        const column = circuit.columns[colIndex];
        const col: any[] = [];
        let row = 0;

        while (row < column.gates.length) {
            const gate = column.gates[row];

            // Empty or occupied cells are encoded as identity (1)
            if (!gate || gate.type === 'OCCUPIED') {
                col.push(1);
                row++;
                continue;
            }

            const gateHeight = gate.height || 1;

            // Store metadata for ALL function gates, including nested circuits and custom labels
            if (gate.isFunctionGate || gate.nestedCircuit) {
                const metadataKey = `${colIndex}_${row}`;
                // Serialize nested circuit recursively to Quirk format
                const serializedNested = gate.nestedCircuit ? serializeCircuit(gate.nestedCircuit) : undefined;
                gateMetadata[metadataKey] = {
                    nestedCircuit: serializedNested,
                    label: gate.label,
                    type: gate.type,
                    isFunctionGate: gate.isFunctionGate,
                    height: gateHeight,
                    backgroundColor: gate.backgroundColor,
                };
            }

            // Map gate type to symbol
            let symbol: string | number = mapGateToQuirkSymbol(gate);
            col.push(symbol);

            // For multi-wire gates, add placeholders for occupied rows to preserve alignment
            for (let i = 1; i < gateHeight && (row + i) < column.gates.length; i++) {
                col.push(1);
            }

            row += gateHeight;
        }

        cols.push(col);
    }

    const result = {
        cols,
        gates: [], // Custom gates would go here
        gateMetadata, // Store our additional metadata
        initialStates: circuit.initialStates, // Preserve initial states
        classicalBitCount: circuit.classicalBitCount || 0, // Preserve classical bit count
    };
    //console.log('[serializeCircuit] Serialization complete, result:', result);
    //console.log('[serializeCircuit] gateMetadata:', gateMetadata);
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

    // Function gates - prefix with __FUNC__ to avoid conflicts with standard gates
    if (gate.isFunctionGate || gate.type === 'FUNCTION' || gate.type === 'ORACLE' || gate.type === 'UNITARY') {
        // Use __FUNC__ prefix with the gate's label (e.g., __FUNC__Uf, __FUNC__V)
        // This prevents conflicts if user names a function "Measure", "H", etc.
        const label = gate.label || gate.type;
        return `__FUNC__${label}`;
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
    //console.log('[deserializeCircuit] Starting deserialization, data:', data);
    if (!data || !data.cols || !Array.isArray(data.cols)) {
        throw new Error("Invalid Quirk JSON format: missing 'cols' array");
    }

    const cols = data.cols;
    const gateMetadata = data.gateMetadata || {};
    //console.log('[deserializeCircuit] gateMetadata:', gateMetadata);
    const initialStates = data.initialStates;
    const columns: CircuitColumn[] = [];
    let maxWires = 0;

    // First pass: determine the number of wires (qubits)
    cols.forEach((col: any[]) => {
        if (Array.isArray(col)) {
            maxWires = Math.max(maxWires, col.length);
        }
    });

    // Ensure at least 1 qubit or enough to fit the circuit
    const qubitCount = Math.max(1, maxWires);

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
                    //console.log(`[deserializeCircuit] Looking for metadata at ${metadataKey}`);
                    if (gateMetadata[metadataKey]) {
                        const metadata = gateMetadata[metadataKey];
                        //console.log(`[deserializeCircuit] Found metadata:`, metadata);
                        if (metadata.nestedCircuit) {
                            try {
                                const nestedCircuit = deserializeCircuit(metadata.nestedCircuit);
                                // Restore gate definitions in nested circuit (including drawer functions)
                                gate.nestedCircuit = restoreCircuitGateDefinitions(nestedCircuit);
                                //console.log(`[deserializeCircuit] Restored nestedCircuit for gate`);
                            } catch (err) {
                                console.error('[deserializeCircuit] Failed to restore nested circuit metadata', err);
                            }
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
                        if (metadata.backgroundColor) {
                            gate.backgroundColor = metadata.backgroundColor;
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
        classicalBitCount: data.classicalBitCount || 0,
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

    // Handle Function Gates
    // Check for old format (__FUNC__TYPE) or new format (custom label)
    if (typeof symbol === 'string') {
        if (symbol.startsWith('__FUNC__')) {
            // Old format with prefix
            const gateType = symbol.substring(8); // Remove '__FUNC__' prefix
            //console.log(`[mapQuirkSymbolToGate] Found function gate, type: ${gateType}`);
            const functionGate = GATES.find(g => g.type === gateType);
            if (functionGate) {
                return { ...functionGate, isFunctionGate: true };
            }
        }
        // If we reach here and the symbol doesn't match any standard gate,
        // it might be a custom function gate label (like "Uf", "V")
        // These will be restored from metadata, so return a placeholder
        // that will be populated with metadata later
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

    // Fallback: If symbol doesn't match any standard gate, assume it's a function gate label
    // (like "Uf", "V", "Oracle", etc.)
    // These will be fully restored from gateMetadata, but we create a placeholder here
    const functionGateTemplate = GATES.find(g => g.type === 'FUNCTION');
    if (functionGateTemplate && typeof symbol === 'string' && symbol.length <= 20) {
        // Likely a custom function gate label
        return {
            ...functionGateTemplate,
            label: symbol,
            isFunctionGate: true,
            height: 1, // Will be overridden by metadata
        };
    }
    
    // Final fallback: Create a mystery gate for truly unknown symbols
    return {
        type: 'MYSTERY',
        id: 'unknown',
        label: symbol.toString(),
        symbol: symbol.toString(),
        description: 'Unknown Gate',
        isControl: false,
        width: 1,
        height: 1
    };
}
