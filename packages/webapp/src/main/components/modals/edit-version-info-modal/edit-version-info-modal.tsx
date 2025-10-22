import React, { useState } from 'react';
import { Button, FormControl, InputGroup, Modal } from 'react-bootstrap';
import { ModalContentProps } from '../application-modal-types';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectDiagram, setCreateNewEditor, updateDiagramThunk } from '../../../services/diagram/diagramSlice';
import { selectVersionActionIndex } from '../../../services/version-management/versionManagementSlice';
import { DiagramRepository } from '../../../services/diagram/diagram-repository';
import { displayError } from '../../../services/error-management/errorManagementSlice';

export const EditVersionModal: React.FC<ModalContentProps> = ({ close }) => {
  const dispatch = useAppDispatch();
  const diagram = useAppSelector(selectDiagram);
  const versionActionIndex = useAppSelector(selectVersionActionIndex);
  const [title, setTitle] = useState<string>(diagram.versions![versionActionIndex].title);
  const [description, setDescription] = useState<string>(diagram.versions![versionActionIndex].description || '');
  const displayToast = () => {
    toast.success(`Successfully edited diagram version`, {
      autoClose: 10000,
    });
  };

  const editVersionInfo = () => {
    const token = diagram.token;

    if (!token || !diagram.versions) {
      dispatch(displayError('Editing failed', 'Can not edit version that is not published on the server.'));
      close();

      return;
    }

    DiagramRepository.editDiagramVersionOnServer(token, versionActionIndex, title, description)
      .then((diagram) => {
        dispatch(updateDiagramThunk({ versions: diagram.versions }));
        dispatch(setCreateNewEditor(true));
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
        <Modal.Title>Edit Version Info</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <>
          <label htmlFor="diagram-title">Diagram Title</label>
          <InputGroup className="mt-1 mb-3">
            <FormControl
              className="diagram-title"
              id="diagram-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </InputGroup>
          <label htmlFor="diagram-description">Diagram Description</label>
          <InputGroup className="mt-1">
            <FormControl
              className="diagram-description"
              id="diagram-description"
              value={description}
              as={'textarea'}
              onChange={(e) => setDescription(e.target.value)}
            />
          </InputGroup>
        </>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={close}>
          Close
        </Button>
        <Button variant="primary" onClick={editVersionInfo}>
          Edit
        </Button>
      </Modal.Footer>
    </>
  );
};
