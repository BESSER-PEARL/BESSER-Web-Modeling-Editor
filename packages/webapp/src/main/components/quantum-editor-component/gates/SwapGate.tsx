import React from 'react';
import { GateDefinition } from './GateDefinition';

// Swap Gate Drawer
const SwapDrawer = ({ rect }: { rect: { x: number, y: number, width: number, height: number } }) => {
    const { width, height } = rect;
    const centerX = width / 2;
    const topY = 10;
    const bottomY = height - 10;

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
    description: 'Swap two qubits',
    width: 1,
    height: 2,
    drawer: (params) => <SwapDrawer {...params} />
};
