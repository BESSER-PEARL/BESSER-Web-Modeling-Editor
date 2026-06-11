import React from 'react';
import { GateDefinition } from './GateDefinition';

import { WIRE_SPACING } from '../layout-constants';

// Swap Gate Drawer
const SwapDrawer = ({ rect }: { rect: { x: number, y: number, width: number, height: number } }) => {
    const { width, height } = rect;
    const centerX = width / 2;

    // Calculate wire positions
    // Assuming Swap is always 2 wires for this specific gate definition
    // If it were resizable, we'd need to handle that, but Swap is typically 2.
    // First wire at WIRE_SPACING / 2
    // Last wire at height - WIRE_SPACING / 2

    const topY = WIRE_SPACING / 2;
    const bottomY = height - (WIRE_SPACING / 2);

    return (
        <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
            {/* Vertical line connecting the two X marks */}
            <line x1={centerX} y1={topY} x2={centerX} y2={bottomY} stroke="black" strokeWidth={1} />

            {/* Top X mark */}
            <line x1={centerX - 5} y1={topY - 5} x2={centerX + 5} y2={topY + 5} stroke="black" strokeWidth={2} />
            <line x1={centerX - 5} y1={topY + 5} x2={centerX + 5} y2={topY - 5} stroke="black" strokeWidth={2} />

            {/* Bottom X mark */}
            <line x1={centerX - 5} y1={bottomY - 5} x2={centerX + 5} y2={bottomY + 5} stroke="black" strokeWidth={2} />
            <line x1={centerX - 5} y1={bottomY + 5} x2={centerX + 5} y2={bottomY - 5} stroke="black" strokeWidth={2} />
        </svg>
    );
};

export const SwapGate: GateDefinition = {
    type: 'SWAP',
    label: 'Swap',
    symbol: '×',
    description: 'SWAP Gate: Exchanges the states of two qubits. |01⟩ ↔ |10⟩, while |00⟩ and |11⟩ unchanged.',
    width: 1,
    height: 2,
    drawer: (params) => <SwapDrawer {...params} />
};
