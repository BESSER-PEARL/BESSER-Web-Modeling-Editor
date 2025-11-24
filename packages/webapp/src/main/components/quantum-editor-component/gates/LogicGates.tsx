import React from 'react';
import { GateDefinition } from './GateDefinition';

import { COLORS } from '../layout-constants';

const LogicDrawer = ({ rect, label }: { rect: { x: number, y: number, width: number, height: number }, label: string }) => {
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

export const ComparisonGate: GateDefinition = {
    type: 'COMPARE',
    label: 'A < B',
    symbol: 'A < B',
    description: 'Compare A and B',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <LogicDrawer {...params} label="A < B" />
};

export const CountingGate: GateDefinition = {
    type: 'COUNT_1S',
    label: 'Count 1s',
    symbol: 'Count 1s',
    description: 'Count number of set bits',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <LogicDrawer {...params} label="Count 1s" />
};

export const CycleBitsGate: GateDefinition = {
    type: 'CYCLE_BITS',
    label: 'Cycle',
    symbol: 'Cycle',
    description: 'Cycle bits',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <LogicDrawer {...params} label="Cycle" />
};

export const ReverseBitsGate: GateDefinition = {
    type: 'REVERSE_BITS',
    label: 'Reverse',
    symbol: 'Reverse',
    description: 'Reverse bit order',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <LogicDrawer {...params} label="Reverse" />
};

export const XorGate: GateDefinition = {
    type: 'XOR',
    label: '⊕',
    symbol: '⊕',
    description: 'XOR Parity',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <LogicDrawer {...params} label="⊕" />
};

export const PhaseGradientGate: GateDefinition = {
    type: 'PHASE_GRADIENT',
    label: 'Phase Grad',
    symbol: 'Phase Grad',
    description: 'Phase Gradient',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <LogicDrawer {...params} label="Phase Grad" />
};
