import React from 'react';
import { GateDefinition } from './GateDefinition';

// QFT Drawer - Quantum Fourier Transform
const QFTDrawer = ({ rect }: { rect: { x: number, y: number, width: number, height: number } }) => {
    const { width, height } = rect;
    const centerY = height / 2;

    return (
        <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
            {/* Background */}
            <rect x={0} y={0} width={width} height={height} fill="white" stroke="black" strokeWidth={1} />

            {/* QFT Label */}
            <text
                x={width / 2}
                y={centerY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="14px"
                fontWeight="bold"
                fill="black"
            >
                QFT
            </text>
        </svg>
    );
};

// QFT Gate
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
    drawer: (params) => <QFTDrawer {...params} />
};

// Inverse QFT Gate
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
    drawer: (params) => (
        <svg width={params.rect.width} height={params.rect.height} style={{ position: 'absolute', top: 0, left: 0 }}>
            <rect x={0} y={0} width={params.rect.width} height={params.rect.height} fill="white" stroke="black" strokeWidth={1} />
            <text
                x={params.rect.width / 2}
                y={params.rect.height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="14px"
                fontWeight="bold"
                fill="black"
            >
                QFT†
            </text>
        </svg>
    )
};
