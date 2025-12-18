import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { Gate } from './Gate';
import { TOOLBOX_GROUPS, GATES } from '../constants';
import { GateType, Circuit } from '../types';
import { EXAMPLE_CIRCUITS, getCircuitsByCategory } from '../exampleCircuits';

const PaletteWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
`;

const PaletteHeader = styled.div`
  padding: 12px;
  border-bottom: 1px solid #e2e8f0;
  background-color: #f8fafc;
  position: relative;
  z-index: 10;
`;

const PaletteContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background-color: #cbd5e1;
    border-radius: 3px;

    &:hover {
      background-color: #94a3b8;
    }
  }
`;

const GroupContainer = styled.div`
  margin-bottom: 16px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const GroupTitle = styled.div`
  font-size: 12px;
  color: #666;
  margin-bottom: 5px;
  text-transform: uppercase;
  font-weight: bold;
`;

const GatesGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
`;

const SelectContainer = styled.div`
  margin-bottom: 16px;
  padding: 0;
`;

const SelectLabel = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
  color: #09090b;
`;

const SelectWrapper = styled.div`
  position: relative;
  width: 100%;
`;

const SelectInput = styled.select`
  width: 100%;
  display: flex;
  height: 40px;
  border-radius: 6px;
  border: 1px solid #e4e4e7;
  background-color: white;
  padding: 8px 12px;
  font-size: 14px;
  font-weight: 500;
  color: #09090b;
  cursor: pointer;
  transition: all 200ms ease;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666666' d='M10.293 3.293L6 7.586 1.707 3.293A1 1 0 00.293 4.707l5 5a1 1 0 001.414 0l5-5a1 1 0 10-1.414-1.414z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  padding-right: 32px;

  &:hover {
    border-color: #d4d4d8;
    background-color: #fafafa;
  }

  &:focus {
    outline: none;
    border-color: #3b82f6;
    ring: 2px;
    ring-color: rgba(59, 130, 246, 0.1);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
    background-color: #fafafa;
  }

  option {
    padding: 8px 12px;
    color: #09090b;
    background-color: white;
    
    &:hover {
      background-color: #f1f5f9;
    }
    
    &:checked {
      background-color: #3b82f6;
      color: white;
    }
  }
`;

// Examples Dropdown Styles
const ExamplesSection = styled.div`
  margin-bottom: 12px;
  position: relative;
`;

const ExamplesButton = styled.button<{ $isOpen: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  border-radius: 6px;
  border: 1px solid #e4e4e7;
  background-color: ${props => props.$isOpen ? '#f0f9ff' : 'white'};
  padding: 8px 12px;
  font-size: 14px;
  font-weight: 500;
  color: #09090b;
  cursor: pointer;
  transition: all 200ms ease;

  &:hover {
    border-color: #3b82f6;
    background-color: #f0f9ff;
  }
`;

const ExamplesDropdown = styled.div<{ $isOpen: boolean }>`
  display: ${props => props.$isOpen ? 'block' : 'none'};
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  max-height: 280px;
  overflow-y: auto;
  z-index: 1000;
`;

const ExampleCategory = styled.div`
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  position: sticky;
  top: 0;
`;

const ExampleItem = styled.div`
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid #f1f5f9;
  transition: background-color 150ms ease;

  &:hover {
    background-color: #f0f9ff;
  }

  &:last-child {
    border-bottom: none;
  }
`;

const ExampleTitle = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: #1e293b;
  margin-bottom: 2px;
`;

const ExampleDescription = styled.div`
  font-size: 11px;
  color: #64748b;
  line-height: 1.3;
`;

interface GatePaletteProps {
    onDragStart?: (gate: GateType, e: React.MouseEvent) => void;
    onLoadCircuit?: (circuit: Circuit) => void;
}

export const GatePalette: React.FC<GatePaletteProps> = ({ onDragStart, onLoadCircuit }) => {
    const [selectedToolbox, setSelectedToolbox] = useState('Toolbox');
    const [examplesOpen, setExamplesOpen] = useState(false);
    const getGate = (type: string) => GATES.find(g => g.type === type);

    const filteredGroups = TOOLBOX_GROUPS.filter(group => group.toolbox === selectedToolbox);
    const circuitsByCategory = getCircuitsByCategory();
    const categoryOrder = ['Basic', 'Algorithms', 'Protocols', 'Advanced'];

    const handleExampleSelect = useCallback((circuit: Circuit) => {
        if (onLoadCircuit) {
            // Deep clone the circuit to avoid mutations
            const clonedCircuit: Circuit = {
                qubitCount: circuit.qubitCount,
                columns: circuit.columns.map(col => ({
                    gates: col.gates.map(g => g ? { ...g, id: `${g.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` } : null)
                })),
                initialStates: circuit.initialStates,
            };
            onLoadCircuit(clonedCircuit);
        }
        setExamplesOpen(false);
    }, [onLoadCircuit]);

    return (
        <PaletteWrapper>
            <PaletteHeader>
                {/* Examples Dropdown */}
                <ExamplesSection>
                    <ExamplesButton 
                        $isOpen={examplesOpen}
                        onClick={() => setExamplesOpen(!examplesOpen)}
                    >
                        <span>Load Example Circuit</span>
                        <span>{examplesOpen ? '▲' : '▼'}</span>
                    </ExamplesButton>
                    <ExamplesDropdown $isOpen={examplesOpen}>
                        {categoryOrder.map(category => (
                            circuitsByCategory[category] && (
                                <React.Fragment key={category}>
                                    <ExampleCategory>{category}</ExampleCategory>
                                    {circuitsByCategory[category].map((example, idx) => (
                                        <ExampleItem
                                            key={`${category}-${idx}`}
                                            onClick={() => handleExampleSelect(example.circuit)}
                                        >
                                            <ExampleTitle>{example.name}</ExampleTitle>
                                            <ExampleDescription>{example.description}</ExampleDescription>
                                        </ExampleItem>
                                    ))}
                                </React.Fragment>
                            )
                        ))}
                    </ExamplesDropdown>
                </ExamplesSection>

                {/* Toolbox Select */}
                <SelectWrapper>
                    <SelectInput
                        id="toolbox-select"
                        value={selectedToolbox}
                        onChange={(e) => setSelectedToolbox(e.target.value)}
                    >
                        <option value="Toolbox">Toolbox 1</option>
                        <option value="Toolbox2">Toolbox 2</option>
                    </SelectInput>
                </SelectWrapper>
            </PaletteHeader>

            <PaletteContent>
                {filteredGroups.map(group => (
                    <GroupContainer key={group.name}>
                        <GroupTitle>{group.name}</GroupTitle>
                        <GatesGrid>
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
                        </GatesGrid>
                    </GroupContainer>
                ))}
            </PaletteContent>
        </PaletteWrapper>
    );
};
