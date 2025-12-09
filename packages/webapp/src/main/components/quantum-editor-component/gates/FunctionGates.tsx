import React from 'react';
import { GateDefinition } from './GateDefinition';
import { Circuit } from '../types';

/**
 * Function Gate - A gate that contains a nested circuit
 * Double-click to open and edit the nested circuit
 */
export const FunctionGate: GateDefinition = {
    type: 'FUNCTION',
    label: 'f(x)',
    symbol: 'f',
    description: 'Function gate - double click to edit nested circuit',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: ({ rect }) => (
        <svg width={rect.width} height={rect.height} style={{ overflow: 'visible' }}>
            <rect
                x={0}
                y={0}
                width={rect.width}
                height={rect.height}
                fill="#FFE8CC"
                stroke="#333"
                strokeWidth={1.5}
                rx={3}
            />
            <text
                x={rect.width / 2}
                y={rect.height / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={14}
                fontWeight="bold"
                fill="#333"
            >
                f(x)
            </text>
            <text
                x={rect.width / 2}
                y={rect.height - 8}
                textAnchor="middle"
                fontSize={9}
                fill="#666"
            >
                ⇆ double-click
            </text>
        </svg>
    ),
};

/**
 * Custom Function Gate - User-defined function with custom label
 */
export const CustomFunctionGate = (label: string = 'g'): GateDefinition => ({
    type: 'CUSTOM_FUNCTION',
    label: `${label}(x)`,
    symbol: label,
    description: `Custom function ${label} - double click to edit nested circuit`,
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: ({ rect }) => (
        <svg width={rect.width} height={rect.height} style={{ overflow: 'visible' }}>
            <rect
                x={0}
                y={0}
                width={rect.width}
                height={rect.height}
                fill="#E8F4FF"
                stroke="#333"
                strokeWidth={1.5}
                rx={3}
            />
            <text
                x={rect.width / 2}
                y={rect.height / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={14}
                fontWeight="bold"
                fill="#333"
            >
                {label}(x)
            </text>
            <text
                x={rect.width / 2}
                y={rect.height - 8}
                textAnchor="middle"
                fontSize={9}
                fill="#666"
            >
                ⇆ double-click
            </text>
        </svg>
    ),
});

/**
 * Oracle Gate - Special function gate used in quantum algorithms
 */
export const OracleGate: GateDefinition = {
    type: 'ORACLE',
    label: 'Oracle',
    symbol: 'O',
    description: 'Oracle function gate - double click to edit',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: ({ rect }) => (
        <svg width={rect.width} height={rect.height} style={{ overflow: 'visible' }}>
            <rect
                x={0}
                y={0}
                width={rect.width}
                height={rect.height}
                fill="#F0E8FF"
                stroke="#333"
                strokeWidth={1.5}
                rx={3}
            />
            <text
                x={rect.width / 2}
                y={rect.height / 2 - 5}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={16}
                fontWeight="bold"
                fill="#333"
            >
                O
            </text>
            <text
                x={rect.width / 2}
                y={rect.height / 2 + 10}
                textAnchor="middle"
                fontSize={10}
                fill="#666"
            >
                oracle
            </text>
            <text
                x={rect.width / 2}
                y={rect.height - 8}
                textAnchor="middle"
                fontSize={9}
                fill="#666"
            >
                ⇆ double-click
            </text>
        </svg>
    ),
};

/**
 * Unitary Gate - Generic unitary transformation
 */
export const UnitaryGate: GateDefinition = {
    type: 'UNITARY',
    label: 'U',
    symbol: 'U',
    description: 'Unitary gate - double click to define circuit',
    width: 1,
    height: 2,
    canResize: true,
    minHeight: 2,
    maxHeight: 16,
    drawer: ({ rect }) => (
        <svg width={rect.width} height={rect.height} style={{ overflow: 'visible' }}>
            <rect
                x={0}
                y={0}
                width={rect.width}
                height={rect.height}
                fill="#FFE8E8"
                stroke="#333"
                strokeWidth={1.5}
                rx={3}
            />
            <text
                x={rect.width / 2}
                y={rect.height / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={16}
                fontWeight="bold"
                fill="#333"
            >
                U
            </text>
            <text
                x={rect.width / 2}
                y={rect.height - 8}
                textAnchor="middle"
                fontSize={9}
                fill="#666"
            >
                ⇆ double-click
            </text>
        </svg>
    ),
};
