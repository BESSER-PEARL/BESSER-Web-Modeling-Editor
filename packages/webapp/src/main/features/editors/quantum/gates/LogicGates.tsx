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
    description: 'Less Than Comparison: Sets output qubit to |1⟩ if A < B. Quantum comparison circuit.',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <LogicDrawer {...params} label="A < B" />
};

export const GreaterThanGate: GateDefinition = {
    type: 'GREATER_THAN',
    label: 'A > B',
    symbol: 'A > B',
    description: 'Greater Than Comparison: Sets output to |1⟩ if register A > register B.',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <LogicDrawer {...params} label="A > B" />
};

export const LessEqualGate: GateDefinition = {
    type: 'LESS_EQUAL',
    label: 'A ≤ B',
    symbol: 'A ≤ B',
    description: 'Less or Equal: Sets output to |1⟩ if register A ≤ register B.',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <LogicDrawer {...params} label="A ≤ B" />
};

export const GreaterEqualGate: GateDefinition = {
    type: 'GREATER_EQUAL',
    label: 'A ≥ B',
    symbol: 'A ≥ B',
    description: 'Greater or Equal: Sets output to |1⟩ if register A ≥ register B.',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <LogicDrawer {...params} label="A ≥ B" />
};

export const EqualGate: GateDefinition = {
    type: 'EQUAL',
    label: 'A = B',
    symbol: 'A = B',
    description: 'Equality Test: Sets output to |1⟩ if registers A and B have same value.',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <LogicDrawer {...params} label="A = B" />
};

export const NotEqualGate: GateDefinition = {
    type: 'NOT_EQUAL',
    label: 'A ≠ B',
    symbol: 'A ≠ B',
    description: 'Inequality Test: Sets output to |1⟩ if registers A and B differ.',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <LogicDrawer {...params} label="A ≠ B" />
};

export const CompareALessGate: GateDefinition = {
    type: 'COMPARE_A_LT',
    label: 'Input < A',
    symbol: 'Input < A',
    description: 'Compare to Input A: Sets output to |1⟩ if qubit register < input A value.',
    width: 1,
    height: 1,
    drawer: (params) => <LogicDrawer {...params} label="Input < A" />
};

export const CompareAGreaterGate: GateDefinition = {
    type: 'COMPARE_A_GT',
    label: 'Input > A',
    symbol: 'Input > A',
    description: 'Compare to Input A: Sets output to |1⟩ if qubit register > input A value.',
    width: 1,
    height: 1,
    drawer: (params) => <LogicDrawer {...params} label="Input > A" />
};

export const CompareAEqualGate: GateDefinition = {
    type: 'COMPARE_A_EQ',
    label: 'Input = A',
    symbol: 'Input = A',
    description: 'Compare to Input A: Sets output to |1⟩ if qubit register equals input A value.',
    width: 1,
    height: 1,
    drawer: (params) => <LogicDrawer {...params} label="Input = A" />
};

export const CountingGate: GateDefinition = {
    type: 'COUNT_1S',
    label: 'Count 1s',
    symbol: 'Count 1s',
    description: 'Population Count: Counts the number of |1⟩ qubits in the register. Output is binary representation.',
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
    description: 'Cycle Bits: Rotates qubit positions cyclically. Top qubit moves to bottom, others shift up.',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <LogicDrawer {...params} label="Cycle" />
};

export const XorGate: GateDefinition = {
    type: 'XOR',
    label: '⊕',
    symbol: '⊕',
    description: 'XOR Parity: Computes XOR of all qubits in register. Output |1⟩ if odd number of |1⟩s.',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: (params) => <LogicDrawer {...params} label="⊕" />
};


