import React from 'react';
import { GateDefinition } from './GateDefinition';
import { GATE_SIZE } from '../constants';

// Ported from Quirk
function interleaveBit(bit: number, len: number): number {
    let h = Math.ceil(len / 2);
    let group = Math.floor(bit / h);
    let stride = bit % h;
    return stride * 2 + group;
}

const InterleaveDrawer = ({ rect }: { rect: { x: number, y: number, width: number, height: number } }) => {
    const lines = [];
    const span = 6; // Fixed for now as per Quirk's example

    const x1 = 5;
    const x2 = rect.width - 5;
    const yStart = 5;
    const heightAvailable = rect.height - 10;
    const step = heightAvailable / (span - 1);

    for (let i = 0; i < span; i++) {
        const j = interleaveBit(i, span);
        const y1 = yStart + i * step;
        const y2 = yStart + j * step;

        lines.push(
            <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="black"
                strokeWidth="1"
            />
        );
    }

    return (
        <svg width={rect.width} height={rect.height} style={{ position: 'absolute', top: 0, left: 0 }}>
            {lines}
        </svg>
    );
};

export const InterleaveGate: GateDefinition = {
    type: 'INTERLEAVE',
    label: 'Interleave',
    description: 'Re-orders blocks of bits into stripes of bits.',
    width: 1,
    height: 6, // Default height, can be resized
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <InterleaveDrawer {...params} />
};

export const DeinterleaveGate: GateDefinition = {
    type: 'DEINTERLEAVE',
    label: 'Deinterleave',
    description: 'Re-orders stripes of bits into blocks of bits.',
    width: 1,
    height: 6,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <InterleaveDrawer {...params} /> // Same drawer, different logic would be in reverse
};
