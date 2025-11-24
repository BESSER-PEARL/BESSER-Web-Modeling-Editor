import React from 'react';
import styled from 'styled-components';
import { Gate } from './Gate';
import { TOOLBOX_GROUPS, GATES } from './constants';
import { GateType } from './types';

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

interface GatePaletteProps {
    onDragStart?: (gate: GateType, e: React.MouseEvent) => void;
}

export const GatePalette: React.FC<GatePaletteProps> = ({ onDragStart }) => {
    const getGate = (type: string) => GATES.find(g => g.type === type);

    return (
        <div>
            {TOOLBOX_GROUPS.map(group => (
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
