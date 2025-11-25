import React from 'react';
import { GateDefinition } from './GateDefinition';

import { COLORS } from '../layout-constants';

const ModularDrawer = ({ rect, label }: { rect: { x: number, y: number, width: number, height: number }, label: string }) => {
    const { width, height } = rect;
    return (
        <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
            <rect x={0} y={0} width={width} height={height} fill={COLORS.OPERATION_BACK} stroke="black" strokeWidth={1} />
            <text
                x={width / 2}
                y={height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="12px"
                fontWeight="bold"
                fill="black"
            >
                {label}
            </text>
        </svg>
    );
};

export const ModularAddGate: GateDefinition = {
    type: 'MOD_ADD',
    label: '+A mod R',
    symbol: '+A mod R',
    description: 'Modular Addition',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <ModularDrawer {...params} label="+A mod R" />
};

export const ModularSubGate: GateDefinition = {
    type: 'MOD_SUB',
    label: '-A mod R',
    symbol: '-A mod R',
    description: 'Modular Subtraction',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <ModularDrawer {...params} label="-A mod R" />
};

export const ModularMulGate: GateDefinition = {
    type: 'MOD_MUL',
    label: '*A mod R',
    symbol: '*A mod R',
    description: 'Modular Multiplication',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <ModularDrawer {...params} label="*A mod R" />
};

export const ModularInvMulGate: GateDefinition = {
    type: 'MOD_INV_MUL',
    label: '/A mod R',
    symbol: '/A mod R',
    description: 'Modular Inverse Multiplication',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <ModularDrawer {...params} label="/A mod R" />
};

export const ModularIncGate: GateDefinition = {
    type: 'MOD_INC',
    label: '+1 mod R',
    symbol: '+1 mod R',
    description: 'Modular Increment',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <ModularDrawer {...params} label="+1 mod R" />
};

export const ModularDecGate: GateDefinition = {
    type: 'MOD_DEC',
    label: '-1 mod R',
    symbol: '-1 mod R',
    description: 'Modular Decrement',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <ModularDrawer {...params} label="-1 mod R" />
};

export const ModularMulBGate: GateDefinition = {
    type: 'MOD_MUL_B',
    label: '*B mod R',
    symbol: '*B mod R',
    description: 'Modular Multiply by B',
    width: 1,
    height: 3,
    canResize: true,
    minHeight: 3,
    maxHeight: 16,
    drawer: (params) => <ModularDrawer {...params} label="*B mod R" />
};

export const ModularMulBInvGate: GateDefinition = {
    type: 'MOD_MUL_B_INV',
    label: '*B A⁻¹ mod R',
    symbol: '*B A⁻¹ mod R',
    description: 'Modular Multiply by B * A inverse',
    width: 1,
    height: 3,
    canResize: true,
    minHeight: 3,
    maxHeight: 16,
    drawer: (params) => <ModularDrawer {...params} label="*B A⁻¹ mod R" />
};
