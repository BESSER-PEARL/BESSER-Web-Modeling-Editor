import React from 'react';
import { Button, Modal } from 'react-bootstrap';
import { ModalContentProps } from '../application-modal-types';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  selectDiagram,
  setDisplayUnpublishedVersion,
  updateDiagramThunk,
} from '../../../services/diagram/diagramSlice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  selectVersionActionIndex,
  setPreviewedDiagramIndex,
} from '../../../services/version-management/versionManagementSlice';
import { LocalStorageRepository } from '../../../services/local-storage/local-storage-repository';
import { displayError } from '../../../services/error-management/errorManagementSlice';
import { DiagramRepository } from '../../../services/diagram/diagram-repository';
import { useNavigate } from 'react-router-dom';

export const RestoreVersionModal: React.FC<ModalContentProps> = ({ close }) => {
  const dispatch = useAppDispatch();
  const diagram = useAppSelector(selectDiagram);
  const versionActionIndex = useAppSelector(selectVersionActionIndex);
  const navigate = useNavigate();

  const displayToast = () => {
    toast.success(`You have successfuly restored the chosen diagram version`, {
      autoClose: 10000,
    });
  };

  const restoreVersion = () => {
    const token = diagram.token;

    if (!token || !diagram.versions) {
      dispatch(displayError('Restore failed', 'Can not restore version that is not published on the server.'));
      close();

      return;
    }

    // Restore version
    const diagramCopy = Object.assign({}, diagram);
    diagramCopy.model = diagram.versions[versionActionIndex].model;
    diagramCopy.title = `Restored: ${diagram.versions[versionActionIndex].title}`;
    diagramCopy.description = diagram.versions[versionActionIndex].description;

    DiagramRepository.publishDiagramVersionOnServer(diagramCopy, token)
      .then((res) => {
        dispatch(updateDiagramThunk(res.diagram));
        dispatch(setPreviewedDiagramIndex(-1));
        dispatch(setDisplayUnpublishedVersion(false));
        LocalStorageRepository.setLastPublishedToken(res.diagramToken);
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
        <Modal.Title>Restore Version</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="m-0">Are you sure you want to restore the version {diagram.title}?</p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={close}>
          Close
        </Button>
        <Button variant="primary" onClick={restoreVersion}>
          Restore
        </Button>
      </Modal.Footer>
    </>
  );
};
