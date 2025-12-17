import React from 'react';
import styled from 'styled-components';
import { Gate } from './Gate';
import { TOOLBOX_GROUPS, GATES } from '../constants';
import { GateType } from '../types';

const GroupContainer = styled.div`
  margin-bottom: 20px;
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

interface GatePaletteProps {
    onDragStart?: (gate: GateType, e: React.MouseEvent) => void;
}

export const GatePalette: React.FC<GatePaletteProps> = ({ onDragStart }) => {
    const [selectedToolbox, setSelectedToolbox] = React.useState('Toolbox');
    const getGate = (type: string) => GATES.find(g => g.type === type);

    const filteredGroups = TOOLBOX_GROUPS.filter(group => group.toolbox === selectedToolbox);

    return (
        <div>
            <SelectContainer>
                <SelectLabel htmlFor="toolbox-select">Toolbox</SelectLabel>
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
            </SelectContainer>
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
        </div>
    );
};
