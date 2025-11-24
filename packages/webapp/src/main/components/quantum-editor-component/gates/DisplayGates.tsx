import React from 'react';
import { GateDefinition } from './GateDefinition';

// Display Gate Drawer (green background for displays)
const DisplayDrawer = ({ rect, label }: { rect: { x: number, y: number, width: number, height: number }, label: string }) => {
    const { width, height } = rect;

    return (
        <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
            <rect x={0} y={0} width={width} height={height} fill="#EFE" stroke="#3F3" strokeWidth={2} />
            <text
                x={width / 2}
                y={height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="12px"
                fontWeight="bold"
                fill="#3F3"
            >
                {label}
            </text>
        </svg>
    );
};

// Bloch Sphere Display
export const BlochSphereGate: GateDefinition = {
    type: 'BLOCH',
    label: 'Bloch',
    symbol: 'B',
    description: 'Bloch Sphere Display',
    width: 1,
    height: 1,
    drawer: (params) => <DisplayDrawer {...params} label="Bloch" />
};

// Density Matrix Display
export const DensityMatrixGate: GateDefinition = {
    type: 'DENSITY',
    label: 'Density',
    symbol: 'ρ',
    description: 'Density Matrix Display',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 1,
    maxHeight: 16,
    drawer: (params) => <DisplayDrawer {...params} label="ρ" />
};

// Probability Display
export const ProbabilityGate: GateDefinition = {
    type: 'PROB',
    label: 'Prob',
    symbol: '%',
    description: 'Probability Display',
    width: 1,
    height: 1,
    drawer: (params) => <DisplayDrawer {...params} label="%" />
};

// Amplitude Display
export const AmplitudeGate: GateDefinition = {
    type: 'AMPLITUDE',
    label: 'Amp',
    symbol: 'A',
    description: 'Amplitude Display',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 1,
    maxHeight: 16,
    drawer: (params) => <DisplayDrawer {...params} label="Amp" />
};

// Chance Display
export const ChanceGate: GateDefinition = {
    type: 'CHANCE',
    label: 'Chance',
    symbol: 'Chance',
    description: 'Measurement Chance Display',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 1,
    maxHeight: 16,
    drawer: (params) => <DisplayDrawer {...params} label="Chance" />
};
