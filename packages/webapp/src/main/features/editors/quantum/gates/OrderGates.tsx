import React from 'react';
import { GateDefinition } from './GateDefinition';
import { WIRE_SPACING } from '../layout-constants';

// Reusing InterleaveDrawer logic
function interleaveBit(bit: number, len: number): number {
    let h = Math.ceil(len / 2);
    let group = Math.floor(bit / h);
    let stride = bit % h;
    return stride * 2 + group;
}

const OrderDrawer = ({ rect, type, label }: { rect: { x: number, y: number, width: number, height: number }, type: string, label: string }) => {
    const lines = [];
    const span = Math.round(rect.height / WIRE_SPACING);
    const getWireY = (index: number) => (index * WIRE_SPACING) + (WIRE_SPACING / 2);
    const x1 = 0;
    const x2 = rect.width;

    if (type === 'INTERLEAVE' || type === 'DEINTERLEAVE') {
        for (let i = 0; i < span; i++) {
            const j = interleaveBit(i, span);
            const y1 = getWireY(i);
            const y2 = getWireY(j);
            let startY, endY;
            if (type === 'INTERLEAVE') {
                startY = y1;
                endY = y2;
            } else {
                startY = y2;
                endY = y1;
            }
            lines.push(
                <g key={i}>
                    <circle cx={x1 + 5} cy={startY} r={2} fill="black" />
                    <line x1={x1 + 5} y1={startY} x2={x2 - 5} y2={endY} stroke="black" strokeWidth="1" />
                    <circle cx={x2 - 5} cy={endY} r={2} fill="black" />
                </g>
            );
        }
    } else if (type === 'ROTATE_LEFT' || type === 'ROTATE_RIGHT' || type === 'REVERSE') {
        for (let i = 0; i < span; i++) {
            let j = i;
            if (type === 'REVERSE') {
                j = span - 1 - i;
            } else if (type === 'ROTATE_LEFT') {
                j = (i - 1 + span) % span;
            } else if (type === 'ROTATE_RIGHT') {
                j = (i + 1) % span;
            }

            const y1 = getWireY(i);
            const y2 = getWireY(j);

            lines.push(
                <g key={i}>
                    <circle cx={x1 + 5} cy={y1} r={2} fill="black" />
                    <line x1={x1 + 5} y1={y1} x2={x2 - 5} y2={y2} stroke="black" strokeWidth="1" />
                    <circle cx={x2 - 5} cy={y2} r={2} fill="black" />
                </g>
            );
        }
        // Add label in the middle
        lines.push(
            <text key="label" x={rect.width / 2} y={rect.height / 2} textAnchor="middle" dominantBaseline="middle" fontSize="12px" fontWeight="bold" fill="rgba(0,0,0,0.5)">
                {label}
            </text>
        );
    } else {
        // Simple box drawer for others for now, or custom logic
        return (
            <svg width={rect.width} height={rect.height} style={{ position: 'absolute', top: 0, left: 0 }}>
                <rect x={0} y={0} width={rect.width} height={rect.height} fill="#FFF" stroke="black" strokeWidth={1} />
                <text x={rect.width / 2} y={rect.height / 2} textAnchor="middle" dominantBaseline="middle" fontSize="12px" fontWeight="bold">
                    {label}
                </text>
            </svg>
        );
    }

    return (
        <svg width={rect.width} height={rect.height} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
            {lines}
        </svg>
    );
};

export const InterleaveGate: GateDefinition = {
    type: 'INTERLEAVE',
    label: 'Interleave',
    description: 'Interleave: Shuffles qubits like interleaving two halves of a deck. Useful for QFT optimization.',
    width: 1,
    height: 6,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <OrderDrawer {...params} type="INTERLEAVE" label="Interleave" />
};

export const DeinterleaveGate: GateDefinition = {
    type: 'DEINTERLEAVE',
    label: 'Deinterleave',
    description: 'Deinterleave: Undoes interleave operation. Separates alternating qubits back into halves.',
    width: 1,
    height: 6,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <OrderDrawer {...params} type="DEINTERLEAVE" label="Deinterleave" />
};

export const ReverseBitsGate: GateDefinition = {
    type: 'REVERSE_BITS',
    label: 'Reverse',
    symbol: 'Reverse',
    description: 'Reverse Bits: Flips the order of qubits. Often needed after QFT to correct bit ordering.',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <OrderDrawer {...params} type="REVERSE" label="Reverse" />
};

export const RotateBitsLeftGate: GateDefinition = {
    type: 'ROTATE_BITS_LEFT',
    label: '<<',
    symbol: '<<',
    description: 'Rotate Left: Cyclically shifts all qubits up by one position. Top wraps to bottom.',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <OrderDrawer {...params} type="ROTATE_LEFT" label="<<" />
};

export const RotateBitsRightGate: GateDefinition = {
    type: 'ROTATE_BITS_RIGHT',
    label: '>>',
    symbol: '>>',
    description: 'Rotate Right: Cyclically shifts all qubits down by one position. Bottom wraps to top.',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <OrderDrawer {...params} type="ROTATE_RIGHT" label=">>" />
};
