import React from 'react';
import styled from 'styled-components';
import { Eye, Pencil, Trash } from 'react-bootstrap-icons';
import { useAppDispatch } from '../../../store/hooks';
import { showModal } from '../../../../services/modal/modalSlice';
import { ModalContentType } from '../../../modals/application-modal-types';
import {
  setPreviewedDiagramIndex,
  setVersionActionIndex,
} from '../../../../services/version-management/versionManagementSlice';

type Props = {
  index: number;
};

const ActionButton = styled.div`
  & {
    padding: 0.35rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.25rem;
    transition: 0.2s ease-in;
  }

  &:hover {
    background-color: var(--apollon-modal-bottom-border);
    cursor: pointer;
  }
`;

export const VersionActions: React.FC<Props> = (props) => {
  const dispatch = useAppDispatch();

  return (
    <div style={{ display: 'flex', marginTop: '0.25rem' }}>
      <ActionButton
        onClick={() => {
          dispatch(setVersionActionIndex(props.index));
          dispatch(showModal({ type: ModalContentType.EditVersionInfoModal, size: 'lg' }));
        }}
      >
        <Pencil />
      </ActionButton>
      <ActionButton
        onClick={() => {
          dispatch(setVersionActionIndex(props.index));
          dispatch(
            showModal({
              type: ModalContentType.DeleteVersionModal,
              size: 'lg',
            }),
          );
        }}
      >
        <Trash />
      </ActionButton>
      <ActionButton
        onClick={() => {
          dispatch(setPreviewedDiagramIndex(props.index));
        }}
      >
        <Eye />
      </ActionButton>
    </div>
  );
};
