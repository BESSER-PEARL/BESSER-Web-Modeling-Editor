import { Gate } from './types';
import {
    InterleaveGate, DeinterleaveGate,
    QFTGate, QFTDaggerGate,
    SwapGate,
    IncrementGate, DecrementGate, AdditionGate, SubtractionGate, MultiplicationGate,
    BlochSphereGate, DensityMatrixGate, ProbabilityGate, AmplitudeGate, ChanceGate
} from './gates';

export const GATE_RADIUS = 20;
export const GATE_SIZE = 40; // 2 * GATE_RADIUS
export const WIRE_SPACING = 50;
export const TOP_MARGIN = 50;
export const LEFT_MARGIN = 50;

export const COLORS = {
    GATE_FILL: 'white',
    HIGHLIGHTED_GATE_FILL: '#FB7',
    TIME_DEPENDENT_HIGHLIGHT: '#FFC',
    DISPLAY_GATE_IN_TOOLBOX_FILL: '#4F4',
    DISPLAY_GATE_BACK: '#EFE',
    DISPLAY_GATE_FORE: '#3F3',
    OPERATION_BACK: '#FFE',
    OPERATION_FORE: '#FF0',
    SUPERPOSITION_BACK: '#EFF',
    SUPERPOSITION_MID: '#8FF',
    SUPERPOSITION_FORE: '#0BB',
    BACKGROUND: 'white',
    TOOLBOX_BACKGROUND: '#CCC',
    STROKE: 'black',
    TEXT: 'black',
};

export const GATES: Gate[] = [
    // Probes
    { type: 'MEASURE', id: 'measure', label: 'Measure', symbol: 'M', description: 'Measures the qubit in the Z basis.', isControl: false },
    { type: 'CONTROL', id: 'control', label: '•', symbol: '•', description: 'Control', isControl: true },
    { type: 'ANTI_CONTROL', id: 'anti-control', label: '◦', symbol: '◦', description: 'Anti-Control', isControl: true },
    { type: 'POST_SELECT_OFF', id: 'post-off', label: '|0⟩', symbol: '|0⟩', description: 'Post-select Off', isControl: false },
    { type: 'POST_SELECT_ON', id: 'post-on', label: '|1⟩', symbol: '|1⟩', description: 'Post-select On', isControl: false },

    // Displays
    { ...BlochSphereGate, id: 'bloch', isControl: false },
    { ...DensityMatrixGate, id: 'density', isControl: false },
    { ...ProbabilityGate, id: 'prob', isControl: false },
    { ...AmplitudeGate, id: 'amp', isControl: false },
    { ...ChanceGate, id: 'chance', isControl: false },

    // Half Turns
    { type: 'H', id: 'h', label: 'H', symbol: 'H', description: 'Hadamard Gate', isControl: false },
    { type: 'X', id: 'x', label: 'X', symbol: 'X', description: 'Pauli X Gate', isControl: false },
    { type: 'Y', id: 'y', label: 'Y', symbol: 'Y', description: 'Pauli Y Gate', isControl: false },
    { type: 'Z', id: 'z', label: 'Z', symbol: 'Z', description: 'Pauli Z Gate', isControl: false },
    { ...SwapGate, id: 'swap', isControl: false },

    // Quarter Turns
    { type: 'S', id: 's', label: 'S', symbol: 'S', description: 'Sqrt Z Gate', isControl: false },
    { type: 'S_DAG', id: 's-dag', label: 'S†', symbol: 'S†', description: 'Inverse Sqrt Z Gate', isControl: false },
    { type: 'V', id: 'v', label: 'V', symbol: '√X', description: 'Sqrt X Gate', isControl: false },
    { type: 'V_DAG', id: 'v-dag', label: 'V†', symbol: '√X†', description: 'Inverse Sqrt X Gate', isControl: false },
    { type: 'SQRT_Y', id: 'sqrt-y', label: '√Y', symbol: '√Y', description: 'Sqrt Y Gate', isControl: false },
    { type: 'SQRT_Y_DAG', id: 'sqrt-y-dag', label: '√Y†', symbol: '√Y†', description: 'Inverse Sqrt Y Gate', isControl: false },

    // Eighth Turns
    { type: 'T', id: 't', label: 'T', symbol: 'T', description: 'Z^1/4 Gate', isControl: false },
    { type: 'T_DAG', id: 't-dag', label: 'T†', symbol: 'T†', description: 'Inverse Z^1/4 Gate', isControl: false },

    // Fourier Transform
    { ...QFTGate, id: 'qft', isControl: false },
    { ...QFTDaggerGate, id: 'qft-dag', isControl: false },

    // Arithmetic
    { ...IncrementGate, id: 'inc', isControl: false },
    { ...DecrementGate, id: 'dec', isControl: false },
    { ...AdditionGate, id: 'add', isControl: false },
    { ...SubtractionGate, id: 'sub', isControl: false },
    { ...MultiplicationGate, id: 'mul', isControl: false },

    // Multi-wire gates
    { ...InterleaveGate, id: 'interleave', isControl: false },
    { ...DeinterleaveGate, id: 'deinterleave', isControl: false },

    // Others
    { type: 'SPACER', id: 'spacer', label: '…', symbol: '…', description: 'Spacer', isControl: false },
];

export const TOOLBOX_GROUPS = [
    {
        name: 'Probes',
        gates: ['MEASURE', 'CONTROL', 'ANTI_CONTROL', 'POST_SELECT_OFF', 'POST_SELECT_ON']
    },
    {
        name: 'Displays',
        gates: ['BLOCH', 'DENSITY', 'PROB', 'AMPLITUDE', 'CHANCE']
    },
    {
        name: 'Half Turns',
        gates: ['H', 'X', 'Y', 'Z', 'SWAP']
    },
    {
        name: 'Quarter Turns',
        gates: ['S', 'S_DAG', 'V', 'V_DAG', 'SQRT_Y', 'SQRT_Y_DAG']
    },
    {
        name: 'Eighth Turns',
        gates: ['T', 'T_DAG']
    },
    {
        name: 'Fourier Transform',
        gates: ['QFT', 'QFT_DAG']
    },
    {
        name: 'Arithmetic',
        gates: ['INC', 'DEC', 'ADD', 'SUB', 'MUL']
    },
    {
        name: 'Multi-Wire',
        gates: ['INTERLEAVE', 'DEINTERLEAVE']
    }
];
