import React from 'react';

export type GateType = string;

export interface Gate {
    type: GateType;
    id: string; // Unique ID for React keys
    label: string;
    symbol?: string; // If different from label
    description?: string;
    width?: number; // Columns spanned (default 1)
    height?: number; // Wires spanned (default 1)
    drawer?: (params: { rect: { x: number, y: number, width: number, height: number } }) => React.ReactNode;
    isControl?: boolean; // Whether this is a control/anti-control gate
    canResize?: boolean; // Whether this gate can be resized (height can change)
    minHeight?: number; // Minimum height for resizable gates (default 2)
    maxHeight?: number; // Maximum height for resizable gates (default 16)
    backgroundColor?: string; // Optional override for gate background color
    noBorder?: boolean; // If true, removes the standard gate border and background
    nestedCircuit?: Circuit; // Nested circuit for function gates
    isFunctionGate?: boolean; // Whether this is a function gate (supports nested circuits)
}

export interface CircuitColumn {
    gates: (Gate | null)[]; // null represents an empty wire at this column
}

export type InitialState = '|0⟩' | '|1⟩' | '|+⟩' | '|−⟩' | '|i⟩' | '|−i⟩';

export interface Circuit {
    columns: CircuitColumn[];
    qubitCount: number;
    classicalBitCount?: number; // Number of classical bits (defaults to 0)
    initialStates?: InitialState[]; // Initial state for each qubit (defaults to |0⟩)
}

export interface Point {
    col: number;
    row: number;
}

export interface DraggedGate {
    gate: Gate;
    offset: { x: number, y: number }; // Offset from mouse cursor to top-left of gate
}
