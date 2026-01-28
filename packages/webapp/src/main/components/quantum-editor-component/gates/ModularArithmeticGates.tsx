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
    description: 'Modular Add: Adds A to register mod R. Result wraps around at R. Key for Shor\'s algorithm.',
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
    description: 'Modular Subtract: Subtracts A from register mod R. Inverse of modular addition.',
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
    description: 'Modular Multiply: Multiplies register by A mod R. Core of modular exponentiation.',
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
    description: 'Modular Division: Multiplies by A⁻¹ mod R. Undoes modular multiplication.',
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
    description: 'Modular Increment: Adds 1 to register mod R. Wraps R-1 to 0.',
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
    description: 'Modular Decrement: Subtracts 1 from register mod R. Wraps 0 to R-1.',
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
    description: 'Modular Multiply by B: Multiplies by second input B mod R. Multi-register operation.',
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
    description: 'Modular Multiply B by A-inverse: Computes B×A⁻¹ mod R. For reversible computation.',
    width: 1,
    height: 3,
    canResize: true,
    minHeight: 3,
    maxHeight: 16,
    drawer: (params) => <ModularDrawer {...params} label="*B A⁻¹ mod R" />
};
