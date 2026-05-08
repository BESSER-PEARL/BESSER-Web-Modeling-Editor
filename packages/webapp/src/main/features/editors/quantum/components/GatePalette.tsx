import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Gate } from './Gate';
import { TOOLBOX_GROUPS, GATES } from '../constants';
import { GateType } from '../types';

interface GatePaletteProps {
    onDragStart?: (gate: GateType, e: React.MouseEvent) => void;
}

export const GatePalette: React.FC<GatePaletteProps> = ({ onDragStart }) => {
    const [selectedToolbox, setSelectedToolbox] = useState('Toolbox');
    const getGate = (type: string) => GATES.find(g => g.type === type);

    const filteredGroups = TOOLBOX_GROUPS.filter(group => group.toolbox === selectedToolbox);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div
                className={cn(
                    'p-3 relative z-10',
                    'border-b border-[var(--quantum-editor-border,#d5dde8)]',
                    'bg-[var(--quantum-editor-surface,#f8fafc)]'
                )}
            >
                {/* Toolbox Select */}
                <div className="quantum-editor-select-wrapper relative w-full">
                    <select
                        id="toolbox-select"
                        value={selectedToolbox}
                        onChange={(e) => setSelectedToolbox(e.target.value)}
                        className={cn(
                            'w-full flex h-10 rounded-md pr-8 px-3 py-2 text-sm font-medium cursor-pointer appearance-none',
                            'border border-[var(--quantum-editor-border,#d5dde8)]',
                            'bg-[var(--quantum-editor-bg,#ffffff)]',
                            'text-[var(--quantum-editor-text,#0f172a)]',
                            'transition-all duration-200 ease-in-out',
                            'hover:border-[var(--quantum-editor-muted-text,#64748b)]',
                            'hover:bg-[var(--quantum-editor-surface,#f8fafc)]',
                            'focus:outline-none focus:border-[var(--quantum-editor-primary,#0284c7)]',
                            'focus:shadow-[0_0_0_3px_var(--quantum-editor-primary-soft,rgba(2,132,199,0.16))]',
                            'disabled:cursor-not-allowed disabled:opacity-50',
                            'disabled:bg-[var(--quantum-editor-muted-surface,#f1f5f9)]'
                        )}
                    >
                        <option value="Toolbox">Toolbox 1</option>
                        <option value="Toolbox2">Toolbox 2</option>
                    </select>
                </div>
            </div>

            <div className="quantum-editor-palette-content flex-1 overflow-y-auto p-3">
                {filteredGroups.map((group, index) => (
                    <div
                        key={group.name}
                        className={cn(
                            'mb-4',
                            index === filteredGroups.length - 1 && 'mb-0'
                        )}
                    >
                        <div
                            className={cn(
                                'text-xs uppercase font-bold mb-[5px]',
                                'text-[var(--quantum-editor-muted-text,#64748b)]'
                            )}
                        >
                            {group.name}
                        </div>
                        <div className="flex flex-wrap gap-[5px]">
                            {group.gates.map(gateType => {
                                const gate = getGate(gateType);
                                if (!gate) return null;
                                return (
                                    <Gate
                                        key={gate.id}
                                        gate={gate}
                                        onMouseDown={(e) => onDragStart && onDragStart(gate.type, e)}
                                    />
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
