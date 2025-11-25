import React from 'react';
import { GateDefinition } from './GateDefinition';

import { COLORS } from '../layout-constants';

const ObscureDrawer = ({ rect, label }: { rect: { x: number, y: number, width: number, height: number }, label: string }) => {
    const { width, height } = rect;
    return (
        <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
            <rect x={0} y={0} width={width} height={height} fill={COLORS.TOOLBOX_BACKGROUND} stroke="black" strokeWidth={1} />
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

export const MysteryGate: GateDefinition = {
    type: 'MYSTERY',
    label: '?',
    symbol: '?',
    description: 'Mystery Gate',
    width: 1,
    height: 1,
    drawer: (params) => <ObscureDrawer {...params} label="?" />
};

export const ZeroGate: GateDefinition = {
    type: 'ZERO',
    label: '0',
    symbol: '0',
    description: 'Project to |0>',
    width: 1,
    height: 1,
    drawer: (params) => <ObscureDrawer {...params} label="0" />
};

export const UniversalNotGate: GateDefinition = {
    type: 'UNIVERSAL_NOT',
    label: 'Not',
    symbol: '⊕',
    description: 'Universal Not',
    width: 1,
    height: 1,
    drawer: (params) => <ObscureDrawer {...params} label="⊕" />
};
