import React from 'react';
import { GateDefinition } from './GateDefinition';
import { COLORS } from '../layout-constants';

const ScalarDrawer = ({ rect, label }: { rect: { x: number, y: number, width: number, height: number }, label: string }) => {
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

export const OneGate: GateDefinition = {
    type: 'ONE',
    label: '1',
    symbol: '1',
    description: 'Identity (1)',
    width: 1,
    height: 1,
    drawer: (params) => <ScalarDrawer {...params} label="1" />
};

export const MinusOneGate: GateDefinition = {
    type: 'MINUS_ONE',
    label: '-1',
    symbol: '-1',
    description: 'Global Phase -1',
    width: 1,
    height: 1,
    drawer: (params) => <ScalarDrawer {...params} label="-1" />
};

export const PhaseIGate: GateDefinition = {
    type: 'PHASE_I',
    label: 'i',
    symbol: 'i',
    description: 'Multiply by i (Phase 90°)',
    width: 1,
    height: 1,
    drawer: (params) => <ScalarDrawer {...params} label="i" />
};

export const PhaseMinusIGate: GateDefinition = {
    type: 'PHASE_MINUS_I',
    label: '-i',
    symbol: '-i',
    description: 'Multiply by -i (Phase -90°)',
    width: 1,
    height: 1,
    drawer: (params) => <ScalarDrawer {...params} label="-i" />
};

export const PhaseSqrtIGate: GateDefinition = {
    type: 'PHASE_SQRT_I',
    label: '√i',
    symbol: '√i',
    description: 'Multiply by sqrt(i) (Phase 45°)',
    width: 1,
    height: 1,
    drawer: (params) => <ScalarDrawer {...params} label="√i" />
};

export const PhaseSqrtMinusIGate: GateDefinition = {
    type: 'PHASE_SQRT_MINUS_I',
    label: '√-i',
    symbol: '√-i',
    description: 'Multiply by sqrt(-i) (Phase -45°)',
    width: 1,
    height: 1,
    drawer: (params) => <ScalarDrawer {...params} label="√-i" />
};
