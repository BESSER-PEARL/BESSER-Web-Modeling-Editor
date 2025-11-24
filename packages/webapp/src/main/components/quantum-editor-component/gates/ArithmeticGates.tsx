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
    description: 'Increment by 1',
    width: 1,
    height: 1,
    drawer: (params) => <ArithmeticDrawer {...params} label="+1" />
};

// Decrement Gate
export const DecrementGate: GateDefinition = {
    type: 'DEC',
    label: '-1',
    symbol: '-1',
    description: 'Decrement by 1',
    width: 1,
    height: 1,
    drawer: (params) => <ArithmeticDrawer {...params} label="-1" />
};

// Addition Gate (resizable)
export const AdditionGate: GateDefinition = {
    type: 'ADD',
    label: '+A',
    symbol: '+A',
    description: 'Add value A',
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
    description: 'Subtract value A',
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
    description: 'Multiply by value A',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <ArithmeticDrawer {...params} label="×A" />
};
