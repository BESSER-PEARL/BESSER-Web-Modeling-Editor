import { Gate } from './types';
import {
    InterleaveGate, DeinterleaveGate,
    QFTGate, QFTDaggerGate,
    SwapGate,
    IncrementGate, DecrementGate, AdditionGate, SubtractionGate, MultiplicationGate,
    BlochSphereGate, DensityMatrixGate, ProbabilityGate, AmplitudeGate, ChanceGate,
    XPowGate, YPowGate, ZPowGate, ExpXGate, ExpYGate, ExpZGate,
    ModularAddGate, ModularSubGate, ModularMulGate, ModularInvMulGate,
    ComparisonGate, CountingGate, CycleBitsGate, ReverseBitsGate, XorGate, PhaseGradientGate,
    InputAGate, InputBGate, RandomGate,
    MysteryGate, ZeroGate, UniversalNotGate
} from './gates';

export * from './layout-constants';

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

    // Parametrized Rotations
    { ...XPowGate, id: 'x-pow', isControl: false },
    { ...YPowGate, id: 'y-pow', isControl: false },
    { ...ZPowGate, id: 'z-pow', isControl: false },
    { ...ExpXGate, id: 'exp-x', isControl: false },
    { ...ExpYGate, id: 'exp-y', isControl: false },
    { ...ExpZGate, id: 'exp-z', isControl: false },

    // Fourier Transform
    { ...QFTGate, id: 'qft', isControl: false },
    { ...QFTDaggerGate, id: 'qft-dag', isControl: false },

    // Arithmetic
    { ...IncrementGate, id: 'inc', isControl: false },
    { ...DecrementGate, id: 'dec', isControl: false },
    { ...AdditionGate, id: 'add', isControl: false },
    { ...SubtractionGate, id: 'sub', isControl: false },
    { ...MultiplicationGate, id: 'mul', isControl: false },

    // Modular Arithmetic
    { ...ModularAddGate, id: 'mod-add', isControl: false },
    { ...ModularSubGate, id: 'mod-sub', isControl: false },
    { ...ModularMulGate, id: 'mod-mul', isControl: false },
    { ...ModularInvMulGate, id: 'mod-inv-mul', isControl: false },

    // Logic
    { ...ComparisonGate, id: 'compare', isControl: false },
    { ...CountingGate, id: 'count-1s', isControl: false },
    { ...CycleBitsGate, id: 'cycle-bits', isControl: false },
    { ...ReverseBitsGate, id: 'reverse-bits', isControl: false },
    { ...XorGate, id: 'xor', isControl: false },
    { ...PhaseGradientGate, id: 'phase-gradient', isControl: false },

    // Input
    { ...InputAGate, id: 'input-a', isControl: false },
    { ...InputBGate, id: 'input-b', isControl: false },
    { ...RandomGate, id: 'random', isControl: false },

    // Multi-wire gates
    { ...InterleaveGate, id: 'interleave', isControl: false },
    { ...DeinterleaveGate, id: 'deinterleave', isControl: false },

    // Obscure
    { ...MysteryGate, id: 'mystery', isControl: false },
    { ...ZeroGate, id: 'zero', isControl: false },
    { ...UniversalNotGate, id: 'universal-not', isControl: false },

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
        name: 'Parametrized',
        gates: ['X_POW', 'Y_POW', 'Z_POW', 'EXP_X', 'EXP_Y', 'EXP_Z']
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
        name: 'Modular',
        gates: ['MOD_ADD', 'MOD_SUB', 'MOD_MUL', 'MOD_INV_MUL']
    },
    {
        name: 'Logic',
        gates: ['COMPARE', 'COUNT_1S', 'CYCLE_BITS', 'REVERSE_BITS', 'XOR', 'PHASE_GRADIENT']
    },
    {
        name: 'Input',
        gates: ['INPUT_A', 'INPUT_B', 'RANDOM']
    },
    {
        name: 'Multi-Wire',
        gates: ['INTERLEAVE', 'DEINTERLEAVE']
    },
    {
        name: 'Obscure',
        gates: ['MYSTERY', 'ZERO', 'UNIVERSAL_NOT']
    }
];
