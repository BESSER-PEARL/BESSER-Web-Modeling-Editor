import React, { useState } from 'react';
import { Button, FormControl, InputGroup, Modal } from 'react-bootstrap';
import { ModalContentProps } from '../application-modal-types';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectDiagram, setCreateNewEditor, updateDiagramThunk } from '../../../services/diagram/diagramSlice';
import { LocalStorageRepository } from '../../../services/local-storage/local-storage-repository';
import { displayError } from '../../../services/error-management/errorManagementSlice';
import { DiagramRepository } from '../../../services/diagram/diagram-repository';
import { setDisplayUnpublishedVersion } from '../../../services/diagram/diagramSlice';

export const CreateVersionModal: React.FC<ModalContentProps> = ({ close }) => {
  const dispatch = useAppDispatch();
  const diagram = useAppSelector(selectDiagram);
  const [title, setTitle] = useState<string>(diagram.title);
  const [description, setDescription] = useState<string>('');

  const displayToast = () => {
    toast.success(`You have successfuly published a new version`, {
      autoClose: 10000,
    });
  };

  const createNewVersion = () => {
    if (!diagram || !diagram.model || Object.keys(diagram.model.elements).length === 0) {
      dispatch(
        displayError(
          'Publishing version fialed',
          'You are trying to publish an empty diagram. Please insert at least one element to the canvas before publishing.',
        ),
      );

      return;
    }

    const token = diagram.token;
    const diagramCopy = Object.assign({}, diagram);
    diagramCopy.title = title;
    diagramCopy.description = description;

    DiagramRepository.publishDiagramVersionOnServer(diagramCopy, token)
      .then((res) => {
        dispatch(updateDiagramThunk(res.diagram));
        dispatch(setCreateNewEditor(true));
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
        <Modal.Title>Create Version</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <>
          <label htmlFor="diagram-title">Diagram Title</label>
          <InputGroup className="mt-1 mb-3">
            <FormControl
              className="diagram-title"
              id="diagram-title"
              onChange={(e) => setTitle(e.target.value)}
              value={title}
            />
          </InputGroup>
          <label htmlFor="diagram-description">Diagram Description</label>
          <InputGroup className="mt-1">
            <FormControl
              className="diagram-description"
              id="diagram-description"
              onChange={(e) => setDescription(e.target.value)}
              as={'textarea'}
              value={description}
            />
          </InputGroup>
        </>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={close}>
          Close
        </Button>
        <Button variant="primary" onClick={createNewVersion}>
          Create
        </Button>
      </Modal.Footer>
    </>
  );
};
