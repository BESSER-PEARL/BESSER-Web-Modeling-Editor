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
    description: 'Z^t (Time Dependent)',
    width: 1,
    height: 1,
    drawer: (params) => <TimeDependentDrawer {...params} label="Z^t" />
};

export const ZPowNegTGate: GateDefinition = {
    type: 'Z_POW_NEG_T',
    label: 'Z^-t',
    symbol: 'Z^-t',
    description: 'Z^-t (Time Dependent)',
    width: 1,
    height: 1,
    drawer: (params) => <TimeDependentDrawer {...params} label="Z^-t" />
};

export const YPowTGate: GateDefinition = {
    type: 'Y_POW_T',
    label: 'Y^t',
    symbol: 'Y^t',
    description: 'Y^t (Time Dependent)',
    width: 1,
    height: 1,
    drawer: (params) => <TimeDependentDrawer {...params} label="Y^t" />
};

export const YPowNegTGate: GateDefinition = {
    type: 'Y_POW_NEG_T',
    label: 'Y^-t',
    symbol: 'Y^-t',
    description: 'Y^-t (Time Dependent)',
    width: 1,
    height: 1,
    drawer: (params) => <TimeDependentDrawer {...params} label="Y^-t" />
};

export const XPowTGate: GateDefinition = {
    type: 'X_POW_T',
    label: 'X^t',
    symbol: 'X^t',
    description: 'X^t (Time Dependent)',
    width: 1,
    height: 1,
    drawer: (params) => <TimeDependentDrawer {...params} label="X^t" />
};

export const XPowNegTGate: GateDefinition = {
    type: 'X_POW_NEG_T',
    label: 'X^-t',
    symbol: 'X^-t',
    description: 'X^-t (Time Dependent)',
    width: 1,
    height: 1,
    drawer: (params) => <TimeDependentDrawer {...params} label="X^-t" />
};

// Formulaic Gates
export const ZFuncTGate: GateDefinition = {
    type: 'Z_FUNC_T',
    label: 'Z(f(t))',
    symbol: 'Z(f(t))',
    description: 'Z Rotation by f(t)',
    width: 1,
    height: 1,
    drawer: (params) => <TimeDependentDrawer {...params} label="Z(f)" />
};

export const RzFuncTGate: GateDefinition = {
    type: 'RZ_FUNC_T',
    label: 'Rz(f(t))',
    symbol: 'Rz(f(t))',
    description: 'Z Axis Rotation by f(t)',
    width: 1,
    height: 1,
    drawer: (params) => <TimeDependentDrawer {...params} label="Rz(f)" />
};

export const YFuncTGate: GateDefinition = {
    type: 'Y_FUNC_T',
    label: 'Y(f(t))',
    symbol: 'Y(f(t))',
    description: 'Y Rotation by f(t)',
    width: 1,
    height: 1,
    drawer: (params) => <TimeDependentDrawer {...params} label="Y(f)" />
};

export const RyFuncTGate: GateDefinition = {
    type: 'RY_FUNC_T',
    label: 'Ry(f(t))',
    symbol: 'Ry(f(t))',
    description: 'Y Axis Rotation by f(t)',
    width: 1,
    height: 1,
    drawer: (params) => <TimeDependentDrawer {...params} label="Ry(f)" />
};

export const XFuncTGate: GateDefinition = {
    type: 'X_FUNC_T',
    label: 'X(f(t))',
    symbol: 'X(f(t))',
    description: 'X Rotation by f(t)',
    width: 1,
    height: 1,
    drawer: (params) => <TimeDependentDrawer {...params} label="X(f)" />
};

export const RxFuncTGate: GateDefinition = {
    type: 'RX_FUNC_T',
    label: 'Rx(f(t))',
    symbol: 'Rx(f(t))',
    description: 'X Axis Rotation by f(t)',
    width: 1,
    height: 1,
    drawer: (params) => <TimeDependentDrawer {...params} label="Rx(f(t))" />
};

export const TimeShiftGate: GateDefinition = {
    type: 'TIME_SHIFT',
    label: '+fT1',
    symbol: '+fT1',
    description: 'Add 1 to time parameter',
    width: 1,
    height: 1,
    drawer: (params) => <TimeDependentDrawer {...params} label="+fT1" />
};

export const TimeShiftInverseGate: GateDefinition = {
    type: 'TIME_SHIFT_INV',
    label: '-fT1',
    symbol: '-fT1',
    description: 'Subtract 1 from time parameter',
    width: 1,
    height: 1,
    drawer: (params) => <TimeDependentDrawer {...params} label="-fT1" />
};
