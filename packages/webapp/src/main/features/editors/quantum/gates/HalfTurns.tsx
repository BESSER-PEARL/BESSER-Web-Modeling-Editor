import React from 'react';
import { Gate } from '../types';
import { COLORS } from '../layout-constants';

const PauliXDrawer = ({ rect }: { rect: { x: number, y: number, width: number, height: number } }) => {
    const { width, height } = rect;
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.min(width, height) / 2 - 5; // Slightly smaller than full cell

    return (
        <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
            <circle cx={cx} cy={cy} r={r} fill={COLORS.GATE_FILL} stroke={COLORS.STROKE} strokeWidth={1} />
            <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke={COLORS.STROKE} strokeWidth={1} />
            <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke={COLORS.STROKE} strokeWidth={1} />
        </svg>
    );
};

export const HGate: Gate = {
    type: 'H',
    id: 'h',
    label: 'H',
    symbol: 'H',
    description: 'Hadamard Gate: Creates superposition by rotating the qubit state 180° around the X+Z axis. Transforms |0⟩ to |+⟩ and |1⟩ to |−⟩.',
    isControl: false
};

export const XGate: Gate = {
    type: 'X',
    id: 'x',
    label: 'X',
    symbol: '⊕',
    description: 'Pauli-X Gate (NOT): Flips the qubit state. Rotates 180° around the X-axis. Transforms |0⟩ ↔ |1⟩.',
    isControl: false,
    noBorder: true,
    drawer: (params) => <PauliXDrawer {...params} />
};

export const YGate: Gate = {
    type: 'Y',
    id: 'y',
    label: 'Y',
    symbol: 'Y',
    description: 'Pauli-Y Gate: Rotates 180° around the Y-axis. Transforms |0⟩ to i|1⟩ and |1⟩ to -i|0⟩.',
    isControl: false
};

export const ZGate: Gate = {
    type: 'Z',
    id: 'z',
    label: 'Z',
    symbol: 'Z',
    description: 'Pauli-Z Gate (Phase Flip): Rotates 180° around the Z-axis. Leaves |0⟩ unchanged, transforms |1⟩ to -|1⟩.',
    isControl: false
};
