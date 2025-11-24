import React from 'react';

export interface GateDefinition {
    type: string;
    label: string;
    symbol?: string;
    description?: string;
    width?: number; // Columns spanned (default 1)
    height?: number; // Wires spanned (default 1)

    // Custom drawer function. 
    // If present, it overrides the default box rendering.
    // We can return a React Node (SVG/Div) to render inside the gate container.
    drawer?: (params: { rect: { x: number, y: number, width: number, height: number } }) => React.ReactNode;

    // Resize properties
    canResize?: boolean; // Whether this gate can be resized
    minHeight?: number; // Minimum height for resizable gates (default 2)
    maxHeight?: number; // Maximum height for resizable gates (default 16)
}
