import React from 'react';
import { GateDefinition } from './GateDefinition';
import { COLORS } from '../layout-constants';

const SamplingDrawer = ({ rect, label }: { rect: { x: number, y: number, width: number, height: number }, label: string }) => {
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

export const SampleGate: GateDefinition = {
    type: 'SAMPLE',
    label: 'Sample',
    symbol: 'Sample',
    description: 'Sample the qubit state',
    width: 1,
    height: 1,
    drawer: (params) => <SamplingDrawer {...params} label="Sample" />
};

export const DetectGate: GateDefinition = {
    type: 'DETECT',
    label: 'Detect',
    symbol: 'Detect',
    description: 'Detect the qubit state',
    width: 1,
    height: 1,
    drawer: (params) => <SamplingDrawer {...params} label="Detect" />
};

export const AxisSampleGate: GateDefinition = {
    type: 'AXIS_SAMPLE',
    label: 'XYZ',
    symbol: 'XYZ',
    description: '3-Axis Sampler',
    width: 1,
    height: 1,
    drawer: (params) => <SamplingDrawer {...params} label="XYZ" />
};
