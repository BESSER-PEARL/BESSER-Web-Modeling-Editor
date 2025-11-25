import React from 'react';
import { GateDefinition } from './GateDefinition';
import { GATE_SIZE, WIRE_SPACING } from '../layout-constants';

function interleaveBit(bit: number, len: number): number {
    let h = Math.ceil(len / 2);
    let group = Math.floor(bit / h);
    let stride = bit % h;
    return stride * 2 + group;
}

const InterleaveDrawer = ({ rect, type }: { rect: { x: number, y: number, width: number, height: number }, type: string }) => {
    const lines = [];
    // Calculate number of wires based on height
    const span = Math.round(rect.height / WIRE_SPACING);

    // Wire vertical positions are relative to the gate's top
    // The first wire is at WIRE_SPACING / 2
    const getWireY = (index: number) => (index * WIRE_SPACING) + (WIRE_SPACING / 2);

    const x1 = 0;
    const x2 = rect.width;

    for (let i = 0; i < span; i++) {
        // For Deinterleave, we swap the mapping direction
        const j = interleaveBit(i, span);

        const y1 = getWireY(i);
        const y2 = getWireY(j);

        // If Deinterleave, input i goes to output j (which is the reverse of Interleave)
        // Actually, Interleave maps input i to output j. 
        // Deinterleave should map input j back to output i.
        // Visually, if Interleave has lines from Left(i) to Right(j),
        // Deinterleave should have lines from Left(j) to Right(i)? 
        // Or simply Left(i) to Right(inverse(i)).

        // Let's stick to: Interleave maps i -> j.
        // So line goes from (0, y(i)) to (width, y(j)).

        // For Deinterleave, it is the inverse. 
        // So line goes from (0, y(j)) to (width, y(i))? 
        // Or rather, we want the visual to look like the inverse operation.
        // If Interleave is i -> j, then Deinterleave is j -> i.
        // So for Deinterleave, we can just draw lines from (0, y(j)) to (width, y(i)).

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
                {/* Input node */}
                <circle cx={x1 + 5} cy={startY} r={2} fill="black" />
                {/* Connection line */}
                <line
                    x1={x1 + 5}
                    y1={startY}
                    x2={x2 - 5}
                    y2={endY}
                    stroke="black"
                    strokeWidth="1"
                />
                {/* Output node */}
                <circle cx={x2 - 5} cy={endY} r={2} fill="black" />
            </g>
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
    description: 'Re-orders blocks of bits into stripes of bits.',
    width: 1,
    height: 6, // Default height, can be resized
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <InterleaveDrawer {...params} type="INTERLEAVE" />
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
    drawer: (params) => <InterleaveDrawer {...params} type="DEINTERLEAVE" />
};
