import React from 'react';
import styled from 'styled-components';
import { useAppDispatch } from '../store/hooks';
import { showModal } from '../../services/modal/modalSlice';
import { ModalContentType } from '../modals/application-modal-types';
import { PlusLg } from 'react-bootstrap-icons';

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.8rem 1.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  border-bottom: 1px solid #e6e6e6;
  color: var(--apollon-background-inverse);
`;

const NewVersionButton = styled.div`
  & {
    display: flex;
    align-items: center;
    justify-content: center;
    transition: 0.2s ease-in;
  }

  &:hover {
    color: #6f7174;
  }
`;

export const TimelineHeader: React.FC = () => {
  const dispatch = useAppDispatch();

  return (
    <Header>
      <div>Version History</div>
      <NewVersionButton
        onClick={() => {
          dispatch(showModal({ type: ModalContentType.CreateVersionModal, size: 'lg' }));
        }}
      >
        <PlusLg style={{ width: '18px', height: '18px' }} />
      </NewVersionButton>
    </Header>
  );
};
