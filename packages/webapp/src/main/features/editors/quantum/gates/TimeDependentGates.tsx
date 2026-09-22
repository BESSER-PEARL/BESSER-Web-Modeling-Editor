import React from 'react';
import { GateDefinition } from './GateDefinition';
import { COLORS } from '../layout-constants';

const TimeDependentDrawer = ({ rect, label }: { rect: { x: number, y: number, width: number, height: number }, label: string }) => {
    const { width, height } = rect;
    return (
        <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
            <rect x={0} y={0} width={width} height={height} fill={COLORS.OPERATION_BACK} stroke="black" strokeWidth={1} />
            <text
                x={width / 2}
                y={height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="14px"
                fontWeight="bold"
                fill="black"
            >
                {label}
            </text>
        </svg>
    );
};

// Spinning Gates (Time Dependent)
export const ZPowTGate: GateDefinition = {
    type: 'Z_POW_T',
    label: 'Z^t',
    symbol: 'Z^t',
    description: 'Spinning Z: Continuously rotates around Z as simulation time t progresses. Phase accumulates over time.',
    width: 1,
    height: 1,
    drawer: (params) => <TimeDependentDrawer {...params} label="Z^t" />
};

export const ZPowNegTGate: GateDefinition = {
    type: 'Z_POW_NEG_T',
    label: 'Z^-t',
    symbol: 'Z^-t',
    description: 'Reverse Spinning Z: Rotates backwards around Z axis. Undoes Z^t for time-reversal.',
    width: 1,
    height: 1,
    drawer: (params) => <TimeDependentDrawer {...params} label="Z^-t" />
};

export const YPowTGate: GateDefinition = {
    type: 'Y_POW_T',
    label: 'Y^t',
    symbol: 'Y^t',
    description: 'Spinning Y: Continuously rotates around Y as simulation time progresses.',
    width: 1,
    height: 1,
    drawer: (params) => <TimeDependentDrawer {...params} label="Y^t" />
};

export const YPowNegTGate: GateDefinition = {
    type: 'Y_POW_NEG_T',
    label: 'Y^-t',
    symbol: 'Y^-t',
    description: 'Reverse Spinning Y: Rotates backwards around Y axis as time progresses.',
    width: 1,
    height: 1,
    drawer: (params) => <TimeDependentDrawer {...params} label="Y^-t" />
};

export const XPowTGate: GateDefinition = {
    type: 'X_POW_T',
    label: 'X^t',
    symbol: 'X^t',
    description: 'Spinning X: Continuously rotates around X as simulation time progresses.',
    width: 1,
    height: 1,
    drawer: (params) => <TimeDependentDrawer {...params} label="X^t" />
};

export const XPowNegTGate: GateDefinition = {
    type: 'X_POW_NEG_T',
    label: 'X^-t',
    symbol: 'X^-t',
    description: 'Reverse Spinning X: Rotates backwards around X axis as time progresses.',
    width: 1,
    height: 1,
    drawer: (params) => <TimeDependentDrawer {...params} label="X^-t" />
};

// Formulaic Gates
export const ZFuncTGate: GateDefinition = {
    type: 'Z_FUNC_T',
    label: 'Z(f(t))',
    symbol: 'Z(f(t))',
    description: 'Formulaic Z: Rotation angle is computed from custom function f(t). For complex dynamics.',
    width: 1,
    height: 1,
    drawer: (params) => <TimeDependentDrawer {...params} label="Z(f)" />
};

export const RzFuncTGate: GateDefinition = {
    type: 'RZ_FUNC_T',
    label: 'Rz(f(t))',
    symbol: 'Rz(f(t))',
    description: 'Formulaic Rz: Z-axis rotation by f(t) radians. Alternative parametrization of Z rotation.',
    width: 1,
    height: 1,
    drawer: (params) => <TimeDependentDrawer {...params} label="Rz(f)" />
};

export const YFuncTGate: GateDefinition = {
    type: 'Y_FUNC_T',
    label: 'Y(f(t))',
    symbol: 'Y(f(t))',
    description: 'Formulaic Y: Y-rotation angle from custom function f(t). For complex dynamics.',
    width: 1,
    height: 1,
    drawer: (params) => <TimeDependentDrawer {...params} label="Y(f)" />
};

export const RyFuncTGate: GateDefinition = {
    type: 'RY_FUNC_T',
    label: 'Ry(f(t))',
    symbol: 'Ry(f(t))',
    description: 'Formulaic Ry: Y-axis rotation by f(t) radians. Alternative parametrization.',
    width: 1,
    height: 1,
    drawer: (params) => <TimeDependentDrawer {...params} label="Ry(f)" />
};

export const XFuncTGate: GateDefinition = {
    type: 'X_FUNC_T',
    label: 'X(f(t))',
    symbol: 'X(f(t))',
    description: 'Formulaic X: X-rotation angle from custom function f(t). For complex dynamics.',
    width: 1,
    height: 1,
    drawer: (params) => <TimeDependentDrawer {...params} label="X(f)" />
};

export const RxFuncTGate: GateDefinition = {
    type: 'RX_FUNC_T',
    label: 'Rx(f(t))',
    symbol: 'Rx(f(t))',
    description: 'Formulaic Rx: X-axis rotation by f(t) radians. Alternative parametrization.',
    width: 1,
    height: 1,
    drawer: (params) => <TimeDependentDrawer {...params} label="Rx(f(t))" />
};

export const TimeShiftGate: GateDefinition = {
    type: 'TIME_SHIFT',
    label: '+fT1',
    symbol: '+fT1',
    description: 'Time Shift +1: Advances the time parameter for subsequent gates. Used for time-based simulations.',
    width: 1,
    height: 1,
    drawer: (params) => <TimeDependentDrawer {...params} label="+fT1" />
};

export const TimeShiftInverseGate: GateDefinition = {
    type: 'TIME_SHIFT_INV',
    label: '-fT1',
    symbol: '-fT1',
    description: 'Time Shift -1: Reverses time parameter for subsequent gates. Undoes time advancement.',
    width: 1,
    height: 1,
    drawer: (params) => <TimeDependentDrawer {...params} label="-fT1" />
};
