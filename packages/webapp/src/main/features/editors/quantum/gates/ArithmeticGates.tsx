import React from 'react';
import { GateDefinition } from './GateDefinition';

import { COLORS } from '../layout-constants';

// Arithmetic Gate Drawer
const ArithmeticDrawer = ({ rect, label }: { rect: { x: number, y: number, width: number, height: number }, label: string }) => {
    const { width, height } = rect;

    return (
        <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
            <rect x={0} y={0} width={width} height={height} fill={COLORS.OPERATION_BACK} stroke="black" strokeWidth={1} />
            <text
                x={width / 2}
                y={height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="16px"
                fontWeight="bold"
                fill="black"
            >
                {label}
            </text>
        </svg>
    );
};

// Increment Gate
export const IncrementGate: GateDefinition = {
    type: 'INC',
    label: '+1',
    symbol: '+1',
    description: 'Increment: Adds 1 to the quantum register interpreted as a binary number. |n⟩ → |n+1⟩.',
    width: 1,
    height: 1,
    drawer: (params) => <ArithmeticDrawer {...params} label="+1" />
};

// Decrement Gate
export const DecrementGate: GateDefinition = {
    type: 'DEC',
    label: '-1',
    symbol: '-1',
    description: 'Decrement: Subtracts 1 from the quantum register. |n⟩ → |n-1⟩ (wraps around).',
    width: 1,
    height: 1,
    drawer: (params) => <ArithmeticDrawer {...params} label="-1" />
};

// Addition Gate (resizable)
export const AdditionGate: GateDefinition = {
    type: 'ADD',
    label: '+A',
    symbol: '+A',
    description: 'Quantum Addition: Adds input register A to target register. Used in quantum arithmetic circuits.',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <ArithmeticDrawer {...params} label="+A" />
};

// Subtraction Gate (resizable)
export const SubtractionGate: GateDefinition = {
    type: 'SUB',
    label: '-A',
    symbol: '-A',
    description: 'Quantum Subtraction: Subtracts input register A from target. Inverse of addition.',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <ArithmeticDrawer {...params} label="-A" />
};

// Multiplication Gate (resizable)
export const MultiplicationGate: GateDefinition = {
    type: 'MUL',
    label: '×A',
    symbol: '×A',
    description: 'Quantum Multiplication: Multiplies target register by input A. Key for Shor\'s algorithm.',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <ArithmeticDrawer {...params} label="×A" />
};

// Add A*B Gate
export const AddABGate: GateDefinition = {
    type: 'ADD_AB',
    label: '+AB',
    symbol: '+AB',
    description: 'Add Product: Adds the product A×B to the target register. Multi-register operation.',
    width: 1,
    height: 3,
    canResize: true,
    minHeight: 3,
    maxHeight: 16,
    drawer: (params) => <ArithmeticDrawer {...params} label="+AB" />
};

// Subtract A*B Gate
export const SubABGate: GateDefinition = {
    type: 'SUB_AB',
    label: '-AB',
    symbol: '-AB',
    description: 'Subtract Product: Subtracts the product A×B from target. Inverse of +AB.',
    width: 1,
    height: 3,
    canResize: true,
    minHeight: 3,
    maxHeight: 16,
    drawer: (params) => <ArithmeticDrawer {...params} label="-AB" />
};

// Inverse Multiplication Gate
export const MulInvGate: GateDefinition = {
    type: 'MUL_INV',
    label: '×A⁻¹',
    symbol: '×A⁻¹',
    description: 'Inverse Multiplication: Divides by A (multiplies by modular inverse). Undoes ×A.',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <ArithmeticDrawer {...params} label="×A⁻¹" />
};
