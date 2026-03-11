import React, { createContext, useContext, useState, ReactNode } from 'react';

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
                <div
                    className="fixed p-2 rounded-md border border-[var(--quantum-editor-border,#d5dde8)] bg-[var(--quantum-editor-surface,#f8fafc)] text-[var(--quantum-editor-text,#0f172a)] z-[1000] pointer-events-none max-w-[300px]"
                    style={{
                        left: tooltip.x + 15,
                        top: tooltip.y + 15,
                        boxShadow: 'var(--quantum-editor-tooltip-shadow, 0 12px 28px rgba(2, 6, 23, 0.18))',
                    }}
                >
                    <div className="font-bold mb-1">{tooltip.title}</div>
                    <div className="text-xs text-[var(--quantum-editor-muted-text,#64748b)]">{tooltip.description}</div>
                </div>
            )}
        </TooltipContext.Provider>
    );
};
