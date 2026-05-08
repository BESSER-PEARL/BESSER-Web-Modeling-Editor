import React from 'react';
import { GateDefinition } from './GateDefinition';

import { COLORS } from '../layout-constants';

// Display Gate Drawer (green background for displays)
const DisplayDrawer = ({ rect, label }: { rect: { x: number, y: number, width: number, height: number }, label: string }) => {
    const { width, height } = rect;

    return (
        <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
            <rect x={0} y={0} width={width} height={height} fill={COLORS.DISPLAY_GATE_BACK} stroke={COLORS.DISPLAY_GATE_FORE} strokeWidth={2} />
            <text
                x={width / 2}
                y={height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="12px"
                fontWeight="bold"
                fill={COLORS.DISPLAY_GATE_FORE}
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
    description: 'Bloch Sphere: Visualizes single qubit state on unit sphere. Poles are |0⟩/|1⟩, equator is superpositions.',
    width: 1,
    height: 1,
    drawer: (params) => <DisplayDrawer {...params} label="Bloch" />
};

// Density Matrix Display
export const DensityMatrixGate: GateDefinition = {
    type: 'DENSITY',
    label: 'Density',
    symbol: 'ρ',
    description: 'Density Matrix (ρ): Shows full quantum state including mixed states. Diagonal = probabilities, off-diagonal = coherences.',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 1,
    maxHeight: 16,
    drawer: (params) => <DisplayDrawer {...params} label="ρ" />
};

// Amplitude Display
export const AmplitudeGate: GateDefinition = {
    type: 'AMPLITUDE',
    label: 'Amp',
    symbol: 'A',
    description: 'Amplitude Display: Shows complex amplitudes for each basis state. Height = magnitude, angle = phase.',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 1,
    maxHeight: 16,
    drawer: (params) => <DisplayDrawer {...params} label="Amp" />
};

// Chance Display (Probability of |1>)
export const ChanceGate: GateDefinition = {
    type: 'CHANCE',
    label: 'Chance',
    symbol: '%',
    description: 'Chance Display: Shows probability (0-100%) of measuring |1⟩ for this qubit.',
    width: 1,
    height: 1,
    drawer: (params) => <DisplayDrawer {...params} label="%" />
};
