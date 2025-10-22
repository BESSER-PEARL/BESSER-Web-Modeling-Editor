import React from 'react';
import styled from 'styled-components';
import { useAppSelector } from '../store/hooks';

export const NameContainer = styled.div`
  color: #353d47;
  background-color: white;
  border-radius: 0.75rem;
  height: 1.5rem !important;
  width: 1.5rem !important;
  margin-left: 0.5rem;
  text-transform: capitalize;
  &:first-of-type {
    margin-left: 0;
  }
  cursor: pointer;
  text-align: center;
`;

export const Container = styled.div`
  display: flex;
  max-width: 25%;
  overflow-x: auto;
  margin-right: 25px;
`;

export function ConnectClientsComponent() {
  const collaborators = useAppSelector((state) => state.share.collaborators);
  const { name } = useAppSelector((state) => state.share.userCollaborationData);

  if (!name || collaborators.length === 0) return;

  const elements = collaborators
    .filter((c) => c != null && c?.name !== name)
    .map((collaborator) => (
      <NameContainer
        style={{ backgroundColor: collaborator?.color }}
        key={collaborator?.name + '_' + collaborator?.color}
        title={collaborator?.name || 'Anonymous'}
      >
        {collaborator ? collaborator.name?.substring(0, 1) : 'A'}
      </NameContainer>
    ));

  return <Container>{elements}</Container>;
}
