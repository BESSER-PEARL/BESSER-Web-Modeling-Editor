import React, { ChangeEvent, useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';
import { ModalContentProps } from '../application-modal-types';
import { useImportDiagram } from '../../../services/import/useImportDiagram';

export const ImportDiagramModal: React.FC<ModalContentProps> = ({ close }) => {
  const [selectedFile, setSelectedFile] = useState<File | undefined>();
  const importDiagram = useImportDiagram();

  const importHandler = async () => {
    if (!selectedFile) return;

    const isJsonFile = selectedFile.name.toLowerCase().endsWith('.json');
    const isPythonFile = selectedFile.name.toLowerCase().endsWith('.py');

    if (!isJsonFile && !isPythonFile) {
      alert('Please select a .json or .py file');
      return;
    }

    try {
      await importDiagram(selectedFile);
      close();
    } catch (error) {
      console.error('Import failed:', error);
      // Error handling is managed by the importDiagram hook
    }
  };

  const fileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  return (
    <>
      <Modal.Header closeButton>
        <Modal.Title>Import Diagram</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-muted mb-3">
          You can import either:
          <br />• JSON files (.json) for BESSER Web Modeling Editor diagram
          <br />• Python files (.py) for BESSER B-UML
        </p>
        <Form.Control
          className="mt-3"
          id="file-input"
          placeholder={selectedFile?.name ?? 'Select a JSON or BUML file'}
          type="file"
          accept=".json,.py"
          onChange={fileUpload}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={close}>
          Close
        </Button>
        <Button variant="primary" onClick={importHandler} disabled={!selectedFile}>
          Import
        </Button>
      </Modal.Footer>
    </>
  );
};
