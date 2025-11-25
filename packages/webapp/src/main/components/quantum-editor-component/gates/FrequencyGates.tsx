import React from 'react';
import { GateDefinition } from './GateDefinition';
import { COLORS } from '../layout-constants';

const FrequencyDrawer = ({ rect, label }: { rect: { x: number, y: number, width: number, height: number }, label: string }) => {
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

export const QFTGate: GateDefinition = {
    type: 'QFT',
    label: 'QFT',
    symbol: 'QFT',
    description: 'Quantum Fourier Transform',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <FrequencyDrawer {...params} label="QFT" />
};

export const QFTDaggerGate: GateDefinition = {
    type: 'QFT_DAG',
    label: 'QFT†',
    symbol: 'QFT†',
    description: 'Inverse Quantum Fourier Transform',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <FrequencyDrawer {...params} label="QFT†" />
};

export const PhaseGradientGate: GateDefinition = {
    type: 'PHASE_GRADIENT',
    label: 'Grad',
    symbol: 'Grad',
    description: 'Phase Gradient',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <FrequencyDrawer {...params} label="Grad" />
};

export const PhaseGradientDaggerGate: GateDefinition = {
    type: 'PHASE_GRADIENT_DAG',
    label: 'Grad†',
    symbol: 'Grad†',
    description: 'Phase Gradient Dagger',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <FrequencyDrawer {...params} label="Grad†" />
};

// Assuming Grad^0.5 and Grad^-0.5 are what was requested as "Grad½" etc.
// Or maybe Grad^-1 (Inverse)
export const PhaseGradientInverseGate: GateDefinition = {
    type: 'PHASE_GRADIENT_INV',
    label: 'Grad⁻¹',
    symbol: 'Grad⁻¹',
    description: 'Inverse Phase Gradient',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <FrequencyDrawer {...params} label="Grad⁻¹" />
};

export const PhaseGradientInverseDaggerGate: GateDefinition = {
    type: 'PHASE_GRADIENT_INV_DAG',
    label: 'Grad⁻¹†',
    symbol: 'Grad⁻¹†',
    description: 'Inverse Phase Gradient Dagger',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <FrequencyDrawer {...params} label="Grad⁻¹†" />
};
