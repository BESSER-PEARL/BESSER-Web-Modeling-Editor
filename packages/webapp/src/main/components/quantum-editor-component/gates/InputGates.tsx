import React from 'react';
import { GateDefinition } from './GateDefinition';
import { COLORS } from '../layout-constants';

const InputDrawer = ({ rect, label }: { rect: { x: number, y: number, width: number, height: number }, label: string }) => {
    const { width, height } = rect;
    return (
        <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
            <rect x={0} y={0} width={width} height={height} fill={COLORS.BACKGROUND} stroke="black" strokeWidth={1} />
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

export const InputAGate: GateDefinition = {
    type: 'INPUT_A',
    label: 'Input A',
    symbol: 'Input A',
    description: 'Input A: Initializes qubits to classical value A (adjustable). Creates computational basis state |A⟩.',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 1,
    maxHeight: 16,
    drawer: (params) => <InputDrawer {...params} label="Input A" />
};

export const InputBGate: GateDefinition = {
    type: 'INPUT_B',
    label: 'Input B',
    symbol: 'Input B',
    description: 'Input B: Initializes qubits to classical value B (adjustable). Second input for arithmetic operations.',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 1,
    maxHeight: 16,
    drawer: (params) => <InputDrawer {...params} label="Input B" />
};

export const RandomGate: GateDefinition = {
    type: 'RANDOM',
    label: 'Random',
    symbol: 'Random',
    description: 'Random State: Initializes qubit to random point on Bloch sphere. Creates mixed state for testing.',
    width: 1,
    height: 1,
    drawer: (params) => <InputDrawer {...params} label="Rand" />
};

export const InputRGate: GateDefinition = {
    type: 'INPUT_R',
    label: 'Input R',
    symbol: 'Input R',
    description: 'Input R (Modulus): Sets the modulus value for modular arithmetic operations.',
    width: 1,
    height: 1,
    drawer: (params) => <InputDrawer {...params} label="Input R" />
};
