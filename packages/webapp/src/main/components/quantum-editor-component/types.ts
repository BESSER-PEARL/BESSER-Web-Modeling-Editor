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
}

export interface CircuitColumn {
    gates: (Gate | null)[]; // null represents an empty wire at this column
}

export interface Circuit {
    columns: CircuitColumn[];
    qubitCount: number;
}

export interface Point {
    col: number;
    row: number;
}

export interface DraggedGate {
    gate: Gate;
    offset: { x: number, y: number }; // Offset from mouse cursor to top-left of gate
}
