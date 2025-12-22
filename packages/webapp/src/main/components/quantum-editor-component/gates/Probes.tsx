import React from 'react';
import { Gate } from '../types';
import { COLORS } from '../layout-constants';

const MeasureDrawer = ({ rect }: { rect: { x: number, y: number, width: number, height: number } }) => (
    <svg width={rect.width} height={rect.height} viewBox={`0 0 ${rect.width} ${rect.height}`}>
        <rect x={0} y={0} width={rect.width} height={rect.height} fill={COLORS.GATE_FILL} stroke="none" />
        {/* Gauge arc */}
        <path d="M 10 25 A 15 15 0 0 1 30 25" fill="none" stroke="black" strokeWidth="2" />
        {/* Needle */}
        <line x1="20" y1="25" x2="28" y2="15" stroke="black" strokeWidth="2" />
        <text x="20" y="35" fontSize="10" textAnchor="middle" fill="black">M</text>
    </svg>
);

export const MeasureGate: Gate = {
    type: 'MEASURE',
    id: 'measure',
    label: 'Measure',
    description: 'Measurement (Z-basis): Collapses qubit superposition to |0⟩ or |1⟩. Result is probabilistic based on qubit amplitudes.',
    isControl: false,
    drawer: MeasureDrawer
};

const MeasureXDrawer = ({ rect }: { rect: { x: number, y: number, width: number, height: number } }) => (
    <svg width={rect.width} height={rect.height} viewBox={`0 0 ${rect.width} ${rect.height}`}>
        <rect x={0} y={0} width={rect.width} height={rect.height} fill={COLORS.GATE_FILL} stroke="none" />
        <path d="M 10 25 A 15 15 0 0 1 30 25" fill="none" stroke="black" strokeWidth="2" />
        <line x1="20" y1="25" x2="28" y2="15" stroke="black" strokeWidth="2" />
        <text x="20" y="35" fontSize="10" textAnchor="middle" fill="black">Mx</text>
    </svg>
);

export const MeasureXGate: Gate = {
    type: 'MEASURE_X',
    id: 'measure-x',
    label: 'Measure X',
    description: 'Measurement (X-basis): Collapses qubit to |+⟩ or |−⟩. Equivalent to H then Z-measurement then H.',
    isControl: false,
    drawer: MeasureXDrawer
};

const MeasureYDrawer = ({ rect }: { rect: { x: number, y: number, width: number, height: number } }) => (
    <svg width={rect.width} height={rect.height} viewBox={`0 0 ${rect.width} ${rect.height}`}>
        <rect x={0} y={0} width={rect.width} height={rect.height} fill={COLORS.GATE_FILL} stroke="none" />
        <path d="M 10 25 A 15 15 0 0 1 30 25" fill="none" stroke="black" strokeWidth="2" />
        <line x1="20" y1="25" x2="28" y2="15" stroke="black" strokeWidth="2" />
        <text x="20" y="35" fontSize="10" textAnchor="middle" fill="black">My</text>
    </svg>
);

export const MeasureYGate: Gate = {
    type: 'MEASURE_Y',
    id: 'measure-y',
    label: 'Measure Y',
    description: 'Measurement (Y-basis): Collapses qubit to |i⟩ or |−i⟩. Measures phase relative to Y-axis.',
    isControl: false,
    drawer: MeasureYDrawer
};

export const ControlGate: Gate = {
    type: 'CONTROL',
    id: 'control',
    label: '•',
    symbol: '•',
    description: 'Control: Conditions other gates on this qubit being |1⟩. Creates CNOT, Toffoli, and other controlled gates.',
    isControl: true
};

export const AntiControlGate: Gate = {
    type: 'ANTI_CONTROL',
    id: 'anti-control',
    label: '◦',
    symbol: '◦',
    description: 'Anti-Control: Conditions other gates on this qubit being |0⟩. Opposite of regular control.',
    isControl: true
};

const PostSelectOffDrawer = ({ rect }: { rect: { x: number, y: number, width: number, height: number } }) => (
    <svg width={rect.width} height={rect.height} viewBox={`0 0 ${rect.width} ${rect.height}`}>
        <rect x={0} y={0} width={rect.width} height={rect.height} fill={COLORS.GATE_FILL} stroke="none" />
        <text x="20" y="25" fontSize="14" textAnchor="middle" fill="black">|0⟩</text>
        <text x="32" y="12" fontSize="10" textAnchor="middle" fill="black">post</text>
    </svg>
);

export const PostSelectOffGate: Gate = {
    type: 'POST_SELECT_OFF',
    id: 'post-off',
    label: '|0⟩',
    description: 'Post-Select |0⟩: Forces qubit to |0⟩. Discards branches where qubit would be |1⟩.',
    isControl: false,
    drawer: PostSelectOffDrawer
};

const PostSelectOnDrawer = ({ rect }: { rect: { x: number, y: number, width: number, height: number } }) => (
    <svg width={rect.width} height={rect.height} viewBox={`0 0 ${rect.width} ${rect.height}`}>
        <rect x={0} y={0} width={rect.width} height={rect.height} fill={COLORS.GATE_FILL} stroke="none" />
        <text x="20" y="25" fontSize="14" textAnchor="middle" fill="black">|1⟩</text>
        <text x="32" y="12" fontSize="10" textAnchor="middle" fill="black">post</text>
    </svg>
);

export const PostSelectOnGate: Gate = {
    type: 'POST_SELECT_ON',
    id: 'post-on',
    label: '|1⟩',
    description: 'Post-Select |1⟩: Forces qubit to |1⟩. Discards branches where qubit would be |0⟩.',
    isControl: false,
    drawer: PostSelectOnDrawer
};

const PostSelectXOffDrawer = ({ rect }: { rect: { x: number, y: number, width: number, height: number } }) => (
    <svg width={rect.width} height={rect.height} viewBox={`0 0 ${rect.width} ${rect.height}`}>
        <rect x={0} y={0} width={rect.width} height={rect.height} fill={COLORS.GATE_FILL} stroke="none" />
        <text x="20" y="25" fontSize="14" textAnchor="middle" fill="black">|+⟩</text>
        <text x="32" y="12" fontSize="10" textAnchor="middle" fill="black">post</text>
    </svg>
);

export const PostSelectXOffGate: Gate = {
    type: 'POST_SELECT_X_OFF',
    id: 'post-x-off',
    label: '|+⟩',
    description: 'Post-Select |+⟩: Forces qubit to superposition (|0⟩+|1⟩)/√2.',
    isControl: false,
    drawer: PostSelectXOffDrawer
};

const PostSelectXOnDrawer = ({ rect }: { rect: { x: number, y: number, width: number, height: number } }) => (
    <svg width={rect.width} height={rect.height} viewBox={`0 0 ${rect.width} ${rect.height}`}>
        <rect x={0} y={0} width={rect.width} height={rect.height} fill={COLORS.GATE_FILL} stroke="none" />
        <text x="20" y="25" fontSize="14" textAnchor="middle" fill="black">|−⟩</text>
        <text x="32" y="12" fontSize="10" textAnchor="middle" fill="black">post</text>
    </svg>
);

export const PostSelectXOnGate: Gate = {
    type: 'POST_SELECT_X_ON',
    id: 'post-x-on',
    label: '|−⟩',
    description: 'Post-Select |−⟩: Forces qubit to superposition (|0⟩−|1⟩)/√2.',
    isControl: false,
    drawer: PostSelectXOnDrawer
};

const PostSelectYOffDrawer = ({ rect }: { rect: { x: number, y: number, width: number, height: number } }) => (
    <svg width={rect.width} height={rect.height} viewBox={`0 0 ${rect.width} ${rect.height}`}>
        <rect x={0} y={0} width={rect.width} height={rect.height} fill={COLORS.GATE_FILL} stroke="none" />
        <text x="20" y="25" fontSize="14" textAnchor="middle" fill="black">|i⟩</text>
        <text x="32" y="12" fontSize="10" textAnchor="middle" fill="black">post</text>
    </svg>
);

export const PostSelectYOffGate: Gate = {
    type: 'POST_SELECT_Y_OFF',
    id: 'post-y-off',
    label: '|i⟩',
    description: 'Post-Select |i⟩: Forces qubit to Y+ eigenstate (|0⟩+i|1⟩)/√2.',
    isControl: false,
    drawer: PostSelectYOffDrawer
};

const PostSelectYOnDrawer = ({ rect }: { rect: { x: number, y: number, width: number, height: number } }) => (
    <svg width={rect.width} height={rect.height} viewBox={`0 0 ${rect.width} ${rect.height}`}>
        <rect x={0} y={0} width={rect.width} height={rect.height} fill={COLORS.GATE_FILL} stroke="none" />
        <text x="20" y="25" fontSize="14" textAnchor="middle" fill="black">|-i⟩</text>
        <text x="32" y="12" fontSize="10" textAnchor="middle" fill="black">post</text>
    </svg>
);

export const PostSelectYOnGate: Gate = {
    type: 'POST_SELECT_Y_ON',
    id: 'post-y-on',
    label: '|-i⟩',
    description: 'Post-Select |−i⟩: Forces qubit to Y− eigenstate (|0⟩−i|1⟩)/√2.',
    isControl: false,
    drawer: PostSelectYOnDrawer
};

// X-Axis Control (⊕)
const ControlXDrawer = ({ rect }: { rect: { x: number, y: number, width: number, height: number } }) => {
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const r = 6;
    return (
        <svg width={rect.width} height={rect.height} style={{ position: 'absolute', top: 0, left: 0 }}>
            <circle cx={cx} cy={cy} r={r} fill="white" stroke="black" strokeWidth={2} />
            <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke="black" strokeWidth={2} />
            <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke="black" strokeWidth={2} />
        </svg>
    );
};

export const ControlXGate: Gate = {
    type: 'CONTROL_X',
    id: 'control-x',
    label: '⨁',
    symbol: '⨁',
    description: 'X-Axis Control: Conditions on X-basis (|+⟩/|−⟩) instead of Z-basis (|0⟩/|1⟩).',
    isControl: true,
    noBorder: true,
    drawer: ControlXDrawer
};

// Y-Axis Control (⊗)
const ControlYDrawer = ({ rect }: { rect: { x: number, y: number, width: number, height: number } }) => {
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const r = 6;
    const r2 = 4;
    return (
        <svg width={rect.width} height={rect.height} style={{ position: 'absolute', top: 0, left: 0 }}>
            <circle cx={cx} cy={cy} r={r} fill="white" stroke="black" strokeWidth={2} />
            {/* X shape inside */}
            <line x1={cx - r2} y1={cy - r2} x2={cx + r2} y2={cy + r2} stroke="black" strokeWidth={2} />
            <line x1={cx + r2} y1={cy - r2} x2={cx - r2} y2={cy + r2} stroke="black" strokeWidth={2} />
        </svg>
    );
};

export const ControlYGate: Gate = {
    type: 'CONTROL_Y',
    id: 'control-y',
    label: '⊗',
    symbol: '⊗',
    description: 'Y-Axis Control: Conditions on Y-basis (|i⟩/|−i⟩) instead of Z-basis.',
    isControl: true,
    noBorder: true,
    drawer: ControlYDrawer
};
