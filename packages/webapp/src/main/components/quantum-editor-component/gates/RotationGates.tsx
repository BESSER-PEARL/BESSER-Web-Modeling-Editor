import React from 'react';
import { GateDefinition } from './GateDefinition';
import { GATE_SIZE, WIRE_SPACING, COLORS } from '../layout-constants';

// Rotation Gate Drawer
const RotationDrawer = ({ rect, label, symbol }: { rect: { x: number, y: number, width: number, height: number }, label: string, symbol: string }) => {
    const { width, height } = rect;
    return (
        <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
            <rect x={0} y={0} width={width} height={height} fill={COLORS.GATE_FILL} stroke="black" strokeWidth={1} />
            <text
                x={width / 2}
                y={height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="14px"
                fontWeight="bold"
                fill="black"
            >
                {symbol || label}
            </text>
        </svg>
    );
};

export const XPowGate: GateDefinition = {
    type: 'X_POW',
    label: 'X^t',
    symbol: 'X^t',
    description: 'X-Rotation (X^t): Rotates by t×180° around X-axis. t=1 is X gate, t=0.5 is √X.',
    width: 1,
    height: 1,
    drawer: (params) => <RotationDrawer {...params} label="X^t" symbol="X^t" />
};

export const YPowGate: GateDefinition = {
    type: 'Y_POW',
    label: 'Y^t',
    symbol: 'Y^t',
    description: 'Y-Rotation (Y^t): Rotates by t×180° around Y-axis. t=1 is Y gate, t=0.5 is √Y.',
    width: 1,
    height: 1,
    drawer: (params) => <RotationDrawer {...params} label="Y^t" symbol="Y^t" />
};

export const ZPowGate: GateDefinition = {
    type: 'Z_POW',
    label: 'Z^t',
    symbol: 'Z^t',
    description: 'Z-Rotation (Z^t): Adds t×180° phase to |1⟩. t=1 is Z, t=0.5 is S, t=0.25 is T.',
    width: 1,
    height: 1,
    drawer: (params) => <RotationDrawer {...params} label="Z^t" symbol="Z^t" />
};

export const ExpXGate: GateDefinition = {
    type: 'EXP_X',
    label: 'Exp(-iXt)',
    symbol: 'e^-iXt',
    description: 'X Exponential: e^(-iXt) - rotates around X by angle 2t. Natural form for Hamiltonian simulation.',
    width: 1,
    height: 1,
    drawer: (params) => <RotationDrawer {...params} label="Exp(-iXt)" symbol="e^-iXt" />
};

export const ExpYGate: GateDefinition = {
    type: 'EXP_Y',
    label: 'Exp(-iYt)',
    symbol: 'e^-iYt',
    description: 'Y Exponential: e^(-iYt) - rotates around Y by angle 2t. Real-valued rotation matrix.',
    width: 1,
    height: 1,
    drawer: (params) => <RotationDrawer {...params} label="Exp(-iYt)" symbol="e^-iYt" />
};

export const ExpZGate: GateDefinition = {
    type: 'EXP_Z',
    label: 'Exp(-iZt)',
    symbol: 'e^-iZt',
    description: 'Z Exponential: e^(-iZt) - phase rotation by angle 2t. Diagonal gate for phase manipulation.',
    width: 1,
    height: 1,
    drawer: (params) => <RotationDrawer {...params} label="Exp(-iZt)" symbol="e^-iZt" />
};
