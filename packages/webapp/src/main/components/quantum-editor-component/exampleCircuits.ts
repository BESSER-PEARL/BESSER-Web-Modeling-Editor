import { Circuit, Gate } from './types';
import { GATES } from './constants';

export interface ExampleCircuit {
    name: string;
    description: string;
    category: 'Basic' | 'Algorithms' | 'Protocols' | 'Advanced';
    circuit: Circuit;
}

// Helper to create a gate object by looking up the full definition from GATES
const gate = (type: string, height?: number): Gate => {
    // Find the gate definition from GATES constant
    const gateDef = GATES.find(g => g.type === type);
    
    if (gateDef) {
        // Clone the gate with a unique ID and optional height override
        return {
            ...gateDef,
            id: `${type}_${Math.random().toString(36).substr(2, 9)}`,
            ...(height !== undefined ? { height } : {}),
        };
    }
    
    // Fallback for gates not found (shouldn't happen with correct types)
    return {
        type,
        id: `${type}_${Math.random().toString(36).substr(2, 9)}`,
        label: type,
        height: height || 1,
        width: 1,
    };
};

// Marker for occupied cells (for multi-qubit gates)
const occupied = (parentId: string, index: number): Gate => ({
    type: 'OCCUPIED',
    id: `${parentId}_occupied_${index}`,
    label: '',
    height: 1,
    width: 1,
});

export const EXAMPLE_CIRCUITS: ExampleCircuit[] = [
    // ============ BASIC CIRCUITS ============
    {
        name: 'Empty Circuit',
        description: 'Start with a blank 4-qubit circuit',
        category: 'Basic',
        circuit: {
            qubitCount: 4,
            columns: [],
        },
    },
    {
        name: 'Single Qubit Gates',
        description: 'Demonstrates basic single-qubit gates: H, X, Y, Z',
        category: 'Basic',
        circuit: {
            qubitCount: 4,
            columns: [
                { gates: [gate('H'), null, null, null] },
                { gates: [null, gate('X'), null, null] },
                { gates: [null, null, gate('Y'), null] },
                { gates: [null, null, null, gate('Z')] },
            ],
        },
    },
    {
        name: 'Superposition',
        description: 'Creates equal superposition on all qubits using Hadamard gates',
        category: 'Basic',
        circuit: {
            qubitCount: 4,
            columns: [
                { gates: [gate('H'), gate('H'), gate('H'), gate('H')] },
            ],
        },
    },
    {
        name: 'Phase Gates',
        description: 'Shows S, T and their inverses for phase manipulation',
        category: 'Basic',
        circuit: {
            qubitCount: 4,
            columns: [
                { gates: [gate('H'), gate('H'), gate('H'), gate('H')] },
                { gates: [gate('Z^½'), null, null, null] },
                { gates: [null, gate('S_DAG'), null, null] },
                { gates: [null, null, gate('T'), null] },
                { gates: [null, null, null, gate('T_DAG')] },
            ],
        },
    },

    // ============ ALGORITHMS ============
    {
        name: 'Bell State (|Φ+⟩)',
        description: 'Creates maximally entangled Bell state: (|00⟩ + |11⟩)/√2',
        category: 'Algorithms',
        circuit: {
            qubitCount: 2,
            columns: [
                { gates: [gate('H'), null] },
                { gates: [gate('CONTROL'), gate('X')] },
            ],
        },
    },
    {
        name: 'GHZ State (3 qubits)',
        description: 'Greenberger-Horne-Zeilinger state: (|000⟩ + |111⟩)/√2',
        category: 'Algorithms',
        circuit: {
            qubitCount: 3,
            columns: [
                { gates: [gate('H'), null, null] },
                { gates: [gate('CONTROL'), gate('X'), null] },
                { gates: [null, gate('CONTROL'), gate('X')] },
            ],
        },
    },
    {
        name: 'Deutsch-Jozsa (2 qubit)',
        description: 'Simplest quantum algorithm - determines if function is constant or balanced',
        category: 'Algorithms',
        circuit: {
            qubitCount: 2,
            columns: [
                { gates: [null, gate('X')] },
                { gates: [gate('H'), gate('H')] },
                { gates: [gate('CONTROL'), gate('X')] },
                { gates: [gate('H'), null] },
                { gates: [gate('MEASURE'), null] },
            ],
        },
    },
    {
        name: 'Quantum Fourier Transform (3 qubit)',
        description: 'QFT transforms computational basis to frequency basis',
        category: 'Algorithms',
        circuit: {
            qubitCount: 3,
            columns: [
                { gates: [gate('H'), null, null] },
                { gates: [gate('Z^½'), gate('CONTROL'), null] },
                { gates: [gate('T'), null, gate('CONTROL')] },
                { gates: [null, gate('H'), null] },
                { gates: [null, gate('Z^½'), gate('CONTROL')] },
                { gates: [null, null, gate('H')] },
                // Swap to reverse bit order
                { gates: [(() => { const g = gate('SWAP', 3); return g; })(), occupied('swap1', 1), occupied('swap1', 2)] },
            ],
        },
    },
    {
        name: 'Grover Search (2 qubit)',
        description: 'Quantum search algorithm - finds marked item in √N steps',
        category: 'Algorithms',
        circuit: {
            qubitCount: 2,
            columns: [
                // Superposition
                { gates: [gate('H'), gate('H')] },
                // Oracle (marks |11⟩)
                { gates: [gate('CONTROL'), gate('Z')] },
                // Diffusion operator
                { gates: [gate('H'), gate('H')] },
                { gates: [gate('X'), gate('X')] },
                { gates: [gate('CONTROL'), gate('Z')] },
                { gates: [gate('X'), gate('X')] },
                { gates: [gate('H'), gate('H')] },
                // Measurement
                { gates: [gate('MEASURE'), gate('MEASURE')] },
            ],
        },
    },

    // ============ PROTOCOLS ============
    {
        name: 'Quantum Teleportation',
        description: 'Teleports quantum state from qubit 0 to qubit 2 using entanglement',
        category: 'Protocols',
        circuit: {
            qubitCount: 3,
            columns: [
                // Prepare Bell pair between qubits 1 and 2
                { gates: [null, gate('H'), null] },
                { gates: [null, gate('CONTROL'), gate('X')] },
                // Bell measurement on qubits 0 and 1
                { gates: [gate('CONTROL'), gate('X'), null] },
                { gates: [gate('H'), null, null] },
                { gates: [gate('MEASURE'), gate('MEASURE'), null] },
                // Classical corrections
                { gates: [null, gate('CONTROL'), gate('X')] },
                { gates: [gate('CONTROL'), null, gate('Z')] },
            ],
        },
    },
    {
        name: 'Superdense Coding',
        description: 'Sends 2 classical bits using 1 qubit via shared entanglement',
        category: 'Protocols',
        circuit: {
            qubitCount: 2,
            columns: [
                // Create Bell pair
                { gates: [gate('H'), null] },
                { gates: [gate('CONTROL'), gate('X')] },
                // Encode 2 bits (example: encode "11")
                { gates: [gate('X'), null] },
                { gates: [gate('Z'), null] },
                // Decode
                { gates: [gate('CONTROL'), gate('X')] },
                { gates: [gate('H'), null] },
                { gates: [gate('MEASURE'), gate('MEASURE')] },
            ],
        },
    },
    {
        name: 'Quantum Key Distribution (BB84)',
        description: 'Simplified BB84 protocol for secure key exchange',
        category: 'Protocols',
        circuit: {
            qubitCount: 2,
            columns: [
                // Alice prepares random bit in random basis
                { gates: [gate('H'), null] },
                // Simulate channel (could add noise)
                { gates: [null, null] },
                // Bob measures in random basis
                { gates: [gate('H'), null] },
                { gates: [gate('MEASURE'), null] },
            ],
        },
    },

    // ============ ADVANCED ============
    {
        name: 'Toffoli Gate (CCNOT)',
        description: 'Controlled-Controlled-NOT: flips target only if both controls are |1⟩',
        category: 'Advanced',
        circuit: {
            qubitCount: 3,
            columns: [
                // Prepare controls in |11⟩
                { gates: [gate('X'), gate('X'), null] },
                // Toffoli decomposition
                { gates: [null, null, gate('H')] },
                { gates: [null, gate('CONTROL'), gate('X')] },
                { gates: [null, null, gate('T_DAG')] },
                { gates: [gate('CONTROL'), null, gate('X')] },
                { gates: [null, null, gate('T')] },
                { gates: [null, gate('CONTROL'), gate('X')] },
                { gates: [null, null, gate('T_DAG')] },
                { gates: [gate('CONTROL'), null, gate('X')] },
                { gates: [null, gate('T'), gate('T')] },
                { gates: [gate('CONTROL'), gate('X'), gate('H')] },
                { gates: [gate('T'), gate('T_DAG'), null] },
                { gates: [gate('CONTROL'), gate('X'), null] },
            ],
        },
    },
    {
        name: 'Quantum Error Detection',
        description: 'Simple 3-qubit bit-flip error detection code',
        category: 'Advanced',
        circuit: {
            qubitCount: 3,
            columns: [
                // Encode logical |0⟩ or |1⟩ into 3 physical qubits
                { gates: [gate('H'), null, null] }, // Optional: start with superposition
                { gates: [gate('CONTROL'), gate('X'), null] },
                { gates: [gate('CONTROL'), null, gate('X')] },
                // Syndrome measurement would go here
                { gates: [gate('MEASURE'), gate('MEASURE'), gate('MEASURE')] },
            ],
        },
    },
    {
        name: 'Quantum Phase Estimation (2+1)',
        description: 'Estimates eigenvalue phase using controlled-U operations',
        category: 'Advanced',
        circuit: {
            qubitCount: 3,
            columns: [
                // Prepare counting register in superposition
                { gates: [gate('H'), gate('H'), null] },
                // Eigenstate (simplified)
                { gates: [null, null, gate('X')] },
                // Controlled-U operations
                { gates: [null, gate('CONTROL'), gate('Z')] },
                { gates: [gate('CONTROL'), null, gate('Z')] },
                { gates: [gate('CONTROL'), null, gate('Z')] },
                // Inverse QFT on counting register
                { gates: [(() => { const g = gate('SWAP', 2); return g; })(), occupied('swap2', 1), null] },
                { gates: [gate('H'), null, null] },
                { gates: [gate('S_DAG'), gate('CONTROL'), null] },
                { gates: [null, gate('H'), null] },
                // Measure
                { gates: [gate('MEASURE'), gate('MEASURE'), null] },
            ],
        },
    },
    {
        name: 'SWAP Test',
        description: 'Tests if two quantum states are identical',
        category: 'Advanced',
        circuit: {
            qubitCount: 3,
            columns: [
                // Ancilla in superposition
                { gates: [gate('H'), null, null] },
                // Controlled-SWAP
                { gates: [gate('CONTROL'), (() => { const g = gate('SWAP', 2); return g; })(), occupied('swap3', 1)] },
                // Hadamard on ancilla
                { gates: [gate('H'), null, null] },
                // Measure ancilla
                { gates: [gate('MEASURE'), null, null] },
            ],
        },
    },
];

// Group circuits by category for menu display
export function getCircuitsByCategory(): Record<string, ExampleCircuit[]> {
    const categories: Record<string, ExampleCircuit[]> = {};
    
    for (const circuit of EXAMPLE_CIRCUITS) {
        if (!categories[circuit.category]) {
            categories[circuit.category] = [];
        }
        categories[circuit.category].push(circuit);
    }
    
    return categories;
}
