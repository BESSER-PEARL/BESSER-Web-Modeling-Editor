import { Gate } from './types';
import {
    InterleaveGate, DeinterleaveGate, RotateBitsLeftGate, RotateBitsRightGate,
    QFTGate, QFTDaggerGate, PhaseGradientGate, PhaseGradientDaggerGate, PhaseGradientInverseGate, PhaseGradientInverseDaggerGate,
    SwapGate,
    IncrementGate, DecrementGate, AdditionGate, SubtractionGate, MultiplicationGate, AddABGate, SubABGate, MulInvGate,
    BlochSphereGate, DensityMatrixGate, AmplitudeGate, ChanceGate,
    XPowGate, YPowGate, ZPowGate, ExpXGate, ExpYGate, ExpZGate,
    ModularAddGate, ModularSubGate, ModularMulGate, ModularInvMulGate, ModularIncGate, ModularDecGate, ModularMulBGate, ModularMulBInvGate,
    ComparisonGate, GreaterThanGate, LessEqualGate, GreaterEqualGate, EqualGate, NotEqualGate, CompareALessGate, CompareAGreaterGate, CompareAEqualGate, CountingGate, CycleBitsGate, ReverseBitsGate, XorGate,
    InputAGate, InputBGate, InputRGate, RandomGate,
    MysteryGate, ZeroGate, UniversalNotGate,
    MeasureGate, MeasureXGate, MeasureYGate, ControlGate, AntiControlGate, PostSelectOffGate, PostSelectOnGate, PostSelectXOffGate, PostSelectXOnGate, PostSelectYOffGate, PostSelectYOnGate, ControlXGate, ControlYGate,
    HGate, XGate, YGate, ZGate,
    SGate, SDaggerGate, VGate, VDaggerGate, SqrtYGate, SqrtYDaggerGate,
    TGate, TDaggerGate,
    SqrtSqrtXGate, SqrtSqrtXDaggerGate, SqrtSqrtYGate, SqrtSqrtYDaggerGate,
    PhaseIGate, PhaseMinusIGate, PhaseSqrtIGate, PhaseSqrtMinusIGate, OneGate, MinusOneGate,
    ZPowTGate, ZPowNegTGate, YPowTGate, YPowNegTGate, XPowTGate, XPowNegTGate,
    ZFuncTGate, RzFuncTGate, YFuncTGate, RyFuncTGate, XFuncTGate, RxFuncTGate, TimeShiftGate, TimeShiftInverseGate,
    SampleGate, DetectGate, AxisSampleGate,
    FunctionGate
} from './gates';

export * from './layout-constants';

export const GATES: Gate[] = [
    // Probes
    { ...MeasureGate, id: 'measure' },
    { ...MeasureXGate, id: 'measure-x' },
    { ...MeasureYGate, id: 'measure-y' },
    { ...ControlGate, id: 'control' },
    { ...AntiControlGate, id: 'anti-control' },
    { ...PostSelectOffGate, id: 'post-off' },
    { ...PostSelectOnGate, id: 'post-on' },
    { ...PostSelectXOffGate, id: 'post-x-off' },
    { ...PostSelectXOnGate, id: 'post-x-on' },
    { ...PostSelectYOffGate, id: 'post-y-off' },
    { ...PostSelectYOnGate, id: 'post-y-on' },
    { ...ControlXGate, id: 'control-x' },
    { ...ControlYGate, id: 'control-y' },

    // // Displays
    // { ...BlochSphereGate, id: 'bloch', isControl: false },
    // { ...DensityMatrixGate, id: 'density', isControl: false },
    // { ...AmplitudeGate, id: 'amp', isControl: false },
    // { ...ChanceGate, id: 'chance', isControl: false },

    // Half Turns
    { ...HGate, id: 'h' },
    { ...XGate, id: 'x' },
    { ...YGate, id: 'y' },
    { ...ZGate, id: 'z' },
    { ...SwapGate, id: 'swap', isControl: false },

    // Quarter Turns
    { ...SGate, id: 's' },
    { ...SDaggerGate, id: 's-dag' },
    { ...VGate, id: 'v' },
    { ...VDaggerGate, id: 'v-dag' },
    { ...SqrtYGate, id: 'sqrt-y' },
    { ...SqrtYDaggerGate, id: 'sqrt-y-dag' },

    // Eighth Turns
    { ...TGate, id: 't' },
    { ...TDaggerGate, id: 't-dag' },
    { ...SqrtSqrtXGate, id: 'sqrt-sqrt-x' },
    { ...SqrtSqrtXDaggerGate, id: 'sqrt-sqrt-x-dag' },
    { ...SqrtSqrtYGate, id: 'sqrt-sqrt-y' },
    { ...SqrtSqrtYDaggerGate, id: 'sqrt-sqrt-y-dag' },

    // Spinning (Time Dependent)
    { ...ZPowTGate, id: 'z-pow-t', isControl: false },
    { ...ZPowNegTGate, id: 'z-pow-neg-t', isControl: false },
    { ...YPowTGate, id: 'y-pow-t', isControl: false },
    { ...YPowNegTGate, id: 'y-pow-neg-t', isControl: false },
    { ...XPowTGate, id: 'x-pow-t', isControl: false },
    { ...XPowNegTGate, id: 'x-pow-neg-t', isControl: false },

    // Formulaic
    { ...ZFuncTGate, id: 'z-func-t', isControl: false },
    { ...RzFuncTGate, id: 'rz-func-t', isControl: false },
    { ...YFuncTGate, id: 'y-func-t', isControl: false },
    { ...RyFuncTGate, id: 'ry-func-t', isControl: false },
    { ...XFuncTGate, id: 'x-func-t', isControl: false },
    { ...XFuncTGate, id: 'x-func-t', isControl: false },
    { ...RxFuncTGate, id: 'rx-func-t', isControl: false },
    { ...TimeShiftGate, id: 'time-shift', isControl: false },
    { ...TimeShiftInverseGate, id: 'time-shift-inv', isControl: false },

    // Parametrized Rotations
    { ...XPowGate, id: 'x-pow', isControl: false },
    { ...YPowGate, id: 'y-pow', isControl: false },
    { ...ZPowGate, id: 'z-pow', isControl: false },
    { ...ExpXGate, id: 'exp-x', isControl: false },
    { ...ExpYGate, id: 'exp-y', isControl: false },
    { ...ExpZGate, id: 'exp-z', isControl: false },

    // Sampling
    // { ...SampleGate, id: 'sample', isControl: false },
    // { ...DetectGate, id: 'detect', isControl: false },
    // { ...AxisSampleGate, id: 'axis-sample', isControl: false },

    // Frequency
    { ...QFTGate, id: 'qft', isControl: false },
    { ...QFTDaggerGate, id: 'qft-dag', isControl: false },
    { ...PhaseGradientGate, id: 'phase-gradient', isControl: false },
    { ...PhaseGradientDaggerGate, id: 'phase-gradient-dag', isControl: false },
    { ...PhaseGradientInverseGate, id: 'phase-gradient-inv', isControl: false },
    { ...PhaseGradientInverseDaggerGate, id: 'phase-gradient-inv-dag', isControl: false },

    // Arithmetic
    { ...IncrementGate, id: 'inc', isControl: false },
    { ...DecrementGate, id: 'dec', isControl: false },
    { ...AdditionGate, id: 'add', isControl: false },
    { ...SubtractionGate, id: 'sub', isControl: false },
    { ...MultiplicationGate, id: 'mul', isControl: false },
    { ...AddABGate, id: 'add-ab', isControl: false },
    { ...SubABGate, id: 'sub-ab', isControl: false },
    { ...MulInvGate, id: 'mul-inv', isControl: false },

    // Modular Arithmetic
    { ...ModularIncGate, id: 'mod-inc', isControl: false },
    { ...ModularDecGate, id: 'mod-dec', isControl: false },
    { ...ModularAddGate, id: 'mod-add', isControl: false },
    { ...ModularSubGate, id: 'mod-sub', isControl: false },
    { ...ModularMulGate, id: 'mod-mul', isControl: false },
    { ...ModularInvMulGate, id: 'mod-inv-mul', isControl: false },
    { ...ModularMulBGate, id: 'mod-mul-b', isControl: false },
    { ...ModularMulBInvGate, id: 'mod-mul-b-inv', isControl: false },

    // Compare
    { ...ComparisonGate, id: 'compare-lt', isControl: false },
    { ...GreaterThanGate, id: 'compare-gt', isControl: false },
    { ...LessEqualGate, id: 'compare-le', isControl: false },
    { ...GreaterEqualGate, id: 'compare-ge', isControl: false },
    { ...EqualGate, id: 'compare-eq', isControl: false },
    { ...NotEqualGate, id: 'compare-ne', isControl: false },
    { ...CompareALessGate, id: 'compare-a-lt', isControl: false },
    { ...CompareAGreaterGate, id: 'compare-a-gt', isControl: false },
    { ...CompareAEqualGate, id: 'compare-a-eq', isControl: false },
    { ...CountingGate, id: 'count-1s', isControl: false },
    { ...CycleBitsGate, id: 'cycle-bits', isControl: false },
    { ...ReverseBitsGate, id: 'reverse-bits', isControl: false },
    { ...XorGate, id: 'xor', isControl: false },

    // Input
    { ...InputAGate, id: 'input-a', isControl: false },
    { ...InputBGate, id: 'input-b', isControl: false },
    { ...InputRGate, id: 'input-r', isControl: false },
    { ...RandomGate, id: 'random', isControl: false },

    // Order
    { ...InterleaveGate, id: 'interleave', isControl: false },
    { ...DeinterleaveGate, id: 'deinterleave', isControl: false },
    { ...RotateBitsLeftGate, id: 'rotate-bits-left', isControl: false },
    { ...RotateBitsRightGate, id: 'rotate-bits-right', isControl: false },

    // Custom
    { ...MysteryGate, id: 'mystery', isControl: false },
    { ...ZeroGate, id: 'zero', isControl: false },
    { ...UniversalNotGate, id: 'universal-not', isControl: false },

    // Scalar
    { ...PhaseIGate, id: 'phase-i', isControl: false },
    { ...PhaseMinusIGate, id: 'phase-minus-i', isControl: false },
    { ...PhaseSqrtIGate, id: 'phase-sqrt-i', isControl: false },
    { ...PhaseSqrtMinusIGate, id: 'phase-sqrt-minus-i', isControl: false },
    { ...OneGate, id: 'one', isControl: false },
    { ...MinusOneGate, id: 'minus-one', isControl: false },

    // Function Gates
    { ...FunctionGate, id: 'function', isControl: false, isFunctionGate: true },

    // Others
    { type: 'SPACER', id: 'spacer', label: '…', symbol: '…', description: 'Spacer', isControl: false },
];

export const TOOLBOX_GROUPS = [
    {
        name: 'Probes',
        toolbox: 'Toolbox',
        gates: ['MEASURE', 'CONTROL', 'ANTI_CONTROL', 'POST_SELECT_OFF', 'POST_SELECT_ON']
    },
    {
        name: 'Displays',
        toolbox: 'Toolbox',
        gates: ['BLOCH', 'DENSITY', 'AMPLITUDE', 'CHANCE']
    },
    {
        name: 'Half Turns',
        toolbox: 'Toolbox',
        gates: ['H', 'X', 'Y', 'Z', 'SWAP']
    },
    {
        name: 'Quarter Turns',
        toolbox: 'Toolbox',
        gates: ['S', 'S_DAG', 'V', 'V_DAG', 'SQRT_Y', 'SQRT_Y_DAG']
    },
    {
        name: 'Eighth Turns',
        toolbox: 'Toolbox',
        gates: ['T', 'T_DAG', 'SQRT_SQRT_X', 'SQRT_SQRT_X_DAG', 'SQRT_SQRT_Y', 'SQRT_SQRT_Y_DAG']
    },
    {
        name: 'Parametrized',
        toolbox: 'Toolbox',
        gates: ['X_POW', 'Y_POW', 'Z_POW', 'EXP_X', 'EXP_Y', 'EXP_Z']
    },
    {
        name: 'Sampling',
        toolbox: 'Toolbox',
        gates: ['SAMPLE', 'DETECT', 'AXIS_SAMPLE']
    },
    {
        name: 'Arithmetic',
        toolbox: 'Toolbox',
        gates: ['INC', 'DEC', 'ADD', 'SUB', 'MUL', 'ADD_AB', 'SUB_AB', 'MUL_INV']
    },
    {
        name: 'Compare',
        toolbox: 'Toolbox',
        gates: ['COMPARE', 'GREATER_THAN', 'LESS_EQUAL', 'GREATER_EQUAL', 'EQUAL', 'NOT_EQUAL', 'COMPARE_A_LT', 'COMPARE_A_GT', 'COMPARE_A_EQ', 'COUNT_1S', 'CYCLE_BITS', 'XOR']
    },
    {
        name: 'Inputs',
        toolbox: 'Toolbox',
        gates: ['INPUT_A', 'INPUT_B', 'INPUT_R', 'RANDOM']
    },
    // Toolbox 2
    {
        name: 'X/Y Probes',
        toolbox: 'Toolbox2',
        gates: ['CONTROL_X', 'CONTROL_Y', 'POST_SELECT_X_OFF', 'POST_SELECT_X_ON', 'POST_SELECT_Y_OFF', 'POST_SELECT_Y_ON', 'MEASURE_X', 'MEASURE_Y']
    },
    {
        name: 'Order',
        toolbox: 'Toolbox2',
        gates: ['INTERLEAVE', 'DEINTERLEAVE', 'REVERSE_BITS', 'ROTATE_BITS_LEFT', 'ROTATE_BITS_RIGHT', 'TIME_SHIFT', 'TIME_SHIFT_INV']
    },
    {
        name: 'Frequency',
        toolbox: 'Toolbox2',
        gates: ['QFT', 'QFT_DAG', 'PHASE_GRADIENT', 'PHASE_GRADIENT_DAG', 'PHASE_GRADIENT_INV', 'PHASE_GRADIENT_INV_DAG']
    },
    {
        name: 'Spinning',
        toolbox: 'Toolbox2',
        gates: ['Z_POW_T', 'Z_POW_NEG_T', 'Y_POW_T', 'Y_POW_NEG_T', 'X_POW_T', 'X_POW_NEG_T']
    },
    {
        name: 'Formulaic',
        toolbox: 'Toolbox2',
        gates: ['Z_FUNC_T', 'RZ_FUNC_T', 'Y_FUNC_T', 'RY_FUNC_T', 'X_FUNC_T', 'RX_FUNC_T']
    },
    {
        name: 'Scalar',
        toolbox: 'Toolbox2',
        gates: ['ONE', 'MINUS_ONE', 'PHASE_I', 'PHASE_MINUS_I', 'PHASE_SQRT_I', 'PHASE_SQRT_MINUS_I']
    },
    {
        name: 'Functions',
        toolbox: 'Toolbox2',
        gates: ['FUNCTION']
    }
    // {
    //     name: 'Custom',
    //     toolbox: 'Toolbox2',
    //     gates: ['MYSTERY', 'ZERO', 'UNIVERSAL_NOT', 'SPACER']
    // }
];
