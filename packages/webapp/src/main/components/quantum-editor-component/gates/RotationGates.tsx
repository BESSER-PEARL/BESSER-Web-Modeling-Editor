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
    description: 'Rotation around X axis by angle t',
    width: 1,
    height: 1,
    drawer: (params) => <RotationDrawer {...params} label="X^t" symbol="X^t" />
};

export const YPowGate: GateDefinition = {
    type: 'Y_POW',
    label: 'Y^t',
    symbol: 'Y^t',
    description: 'Rotation around Y axis by angle t',
    width: 1,
    height: 1,
    drawer: (params) => <RotationDrawer {...params} label="Y^t" symbol="Y^t" />
};

export const ZPowGate: GateDefinition = {
    type: 'Z_POW',
    label: 'Z^t',
    symbol: 'Z^t',
    description: 'Rotation around Z axis by angle t',
    width: 1,
    height: 1,
    drawer: (params) => <RotationDrawer {...params} label="Z^t" symbol="Z^t" />
};

export const ExpXGate: GateDefinition = {
    type: 'EXP_X',
    label: 'Exp(-iXt)',
    symbol: 'e^-iXt',
    description: 'Exponentiated Pauli X',
    width: 1,
    height: 1,
    drawer: (params) => <RotationDrawer {...params} label="Exp(-iXt)" symbol="e^-iXt" />
};

export const ExpYGate: GateDefinition = {
    type: 'EXP_Y',
    label: 'Exp(-iYt)',
    symbol: 'e^-iYt',
    description: 'Exponentiated Pauli Y',
    width: 1,
    height: 1,
    drawer: (params) => <RotationDrawer {...params} label="Exp(-iYt)" symbol="e^-iYt" />
};

export const ExpZGate: GateDefinition = {
    type: 'EXP_Z',
    label: 'Exp(-iZt)',
    symbol: 'e^-iZt',
    description: 'Exponentiated Pauli Z',
    width: 1,
    height: 1,
    drawer: (params) => <RotationDrawer {...params} label="Exp(-iZt)" symbol="e^-iZt" />
};
