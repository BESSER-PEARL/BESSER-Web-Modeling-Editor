import React from 'react';
import { Button, Modal } from 'react-bootstrap';
import { ModalContentProps } from '../application-modal-types';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectDiagram, updateDiagramThunk } from '../../../services/diagram/diagramSlice';
import { displayError } from '../../../services/error-management/errorManagementSlice';
import { DiagramRepository } from '../../../services/diagram/diagram-repository';
import {
  selectVersionActionIndex,
  setPreviewedDiagramIndex,
} from '../../../services/version-management/versionManagementSlice';

export const DeleteVersionModal: React.FC<ModalContentProps> = ({ close }) => {
  const dispatch = useAppDispatch();
  const diagram = useAppSelector(selectDiagram);
  const versionActionIndex = useAppSelector(selectVersionActionIndex);

  const displayToast = () => {
    toast.success(`You have successfuly deleted the chosen diagram version`, {
      autoClose: 10000,
    });
  };

  const deleteVersion = () => {
    const token = diagram.token;

    if (!token || !diagram.versions) {
      dispatch(displayError('Deleting failed', 'Can not delete version that is not published on the server.'));
      close();

      return;
    }

    DiagramRepository.deleteDiagramVersionOnServer(token, versionActionIndex)
      .then((diagram) => {
        dispatch(updateDiagramThunk({ versions: diagram.versions }));
        dispatch(setPreviewedDiagramIndex(-1));
        displayToast();
      })
      .catch((error) => {
        dispatch(
          displayError('Connection failed', 'Connection to the server failed. Please try again or report a problem.'),
        );
        console.error(error);
      })
      .finally(() => {
        close();
      });
  };

  return (
    <>
      <Modal.Header closeButton>
        <Modal.Title>Delete Version</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="m-0">Are you sure you want to delete the version {diagram.title}? This change is irreversible.</p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={close}>
          Close
        </Button>
        <Button variant="danger" onClick={deleteVersion}>
          Delete
        </Button>
      </Modal.Footer>
    </>
  );
};
