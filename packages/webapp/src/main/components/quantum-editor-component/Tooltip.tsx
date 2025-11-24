import React, { createContext, useContext, useState, ReactNode } from 'react';
import { COLORS } from './layout-constants';

interface TooltipData {
    visible: boolean;
    x: number;
    y: number;
    title: string;
    description: string;
}

interface TooltipContextType {
    showTooltip: (x: number, y: number, title: string, description: string) => void;
    hideTooltip: () => void;
}

const TooltipContext = createContext<TooltipContextType | undefined>(undefined);

export const useTooltip = () => {
    const context = useContext(TooltipContext);
    if (!context) {
        throw new Error('useTooltip must be used within a TooltipProvider');
    }
    return context;
};

export const TooltipProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [tooltip, setTooltip] = useState<TooltipData>({
        visible: false,
        x: 0,
        y: 0,
        title: '',
        description: ''
    });

    const showTooltip = (x: number, y: number, title: string, description: string) => {
        setTooltip({ visible: true, x, y, title, description });
    };

    const hideTooltip = () => {
        setTooltip(prev => ({ ...prev, visible: false }));
    };

    return (
        <TooltipContext.Provider value={{ showTooltip, hideTooltip }}>
            {children}
            {tooltip.visible && (
                <div style={{
                    position: 'fixed',
                    left: tooltip.x + 15, // Offset slightly from cursor
                    top: tooltip.y + 15,
                    backgroundColor: 'white',
                    border: '1px solid black',
                    padding: '8px',
                    borderRadius: '4px',
                    boxShadow: '2px 2px 5px rgba(0,0,0,0.2)',
                    zIndex: 1000,
                    pointerEvents: 'none', // Don't interfere with mouse events
                    maxWidth: '300px'
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{tooltip.title}</div>
                    <div style={{ fontSize: '12px' }}>{tooltip.description}</div>
                </div>
            )}
        </TooltipContext.Provider>
    );
};
