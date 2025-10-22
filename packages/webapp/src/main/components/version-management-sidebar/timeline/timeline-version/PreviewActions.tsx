import React from 'react';
import { styled } from 'styled-components';
import { useAppDispatch } from '../../../store/hooks';
import {
  setPreviewedDiagramIndex,
  setVersionActionIndex,
} from '../../../../services/version-management/versionManagementSlice';
import { showModal } from '../../../../services/modal/modalSlice';
import { ModalContentType } from '../../../modals/application-modal-types';

const ActionsContainer = styled.div`
  width: 100%;
  display: flex;
  justify-content: space-between;
  margin-top: 0.25rem;

  div {
    font-size: 0.75rem;
    border-radius: 0.25rem;
    transition: 0.2s ease-in;
    padding: 0.25rem;
  }

  div:hover {
    background-color: var(--apollon-modal-bottom-border);
    cursor: pointer;
  }
`;

type Props = {
  index: number;
};

export const PreviewActions: React.FC<Props> = (props) => {
  const dispatch = useAppDispatch();

  return (
    <ActionsContainer>
      <div
        onClick={() => {
          dispatch(setPreviewedDiagramIndex(-1));
        }}
      >
        Exit preview
      </div>
      <div
        onClick={() => {
          dispatch(setVersionActionIndex(props.index));
          dispatch(showModal({ type: ModalContentType.RestoreVersionModal, size: 'lg' }));
        }}
      >
        Restore version
      </div>
    </ActionsContainer>
  );
};
