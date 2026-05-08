import { Gate } from '../types';

export const SGate: Gate = {
    type: 'Z^½',
    id: 's',
    label: 'S',
    symbol: 'S',
    description: 'S Gate (√Z): Rotates 90° around Z-axis. Adds a phase of i to |1⟩. Two S gates = one Z gate.',
    isControl: false
};

export const SDaggerGate: Gate = {
    type: 'S_DAG',
    id: 's-dag',
    label: 'S†',
    symbol: 'Z^-½',
    description: 'S-Dagger Gate (inverse √Z): Rotates -90° around Z-axis. Adds a phase of -i to |1⟩. Undoes S gate.',
    isControl: false
};

export const VGate: Gate = {
    type: 'X^½',
    id: 'v',
    label: 'V',
    symbol: '√X',
    description: 'V Gate (√X): Rotates 90° around X-axis. Two V gates = one X (NOT) gate.',
    isControl: false
};

export const VDaggerGate: Gate = {
    type: 'V_DAG',
    id: 'v-dag',
    label: 'V†',
    symbol: 'X^-½',
    description: 'V-Dagger Gate (inverse √X): Rotates -90° around X-axis. Undoes V gate.',
    isControl: false
};

export const SqrtYGate: Gate = {
    type: 'SQRT_Y',
    id: 'sqrt-y',
    label: '√Y',
    symbol: 'Y^½',
    description: '√Y Gate: Rotates 90° around Y-axis. Two √Y gates = one Y gate.',
    isControl: false
};

export const SqrtYDaggerGate: Gate = {
    type: 'SQRT_Y_DAG',
    id: 'sqrt-y-dag',
    label: '√Y†',
    symbol: 'Y^-½',
    description: '√Y-Dagger Gate (inverse √Y): Rotates -90° around Y-axis. Undoes √Y gate.',
    isControl: false
};
