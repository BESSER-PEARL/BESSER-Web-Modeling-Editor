import React, { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import { getClassOptions } from '../../grapesjs-editor/diagram-helpers';

interface AddPageModalProps {
  show: boolean;
  onClose: () => void;
  onCreate: (selectedClassId: string | null) => void;
}

export const AddPageModal: React.FC<AddPageModalProps> = ({ show, onClose, onCreate }) => {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const classOptions = getClassOptions();

  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Add New Page</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group controlId="formClassSelect">
            <Form.Label>Select Class (optional)</Form.Label>
            <Form.Control
              as="select"
              value={selectedClassId || ''}
              onChange={e => setSelectedClassId(e.target.value || null)}
            >
              <option value="">-- Blank Page --</option>
              {classOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Form.Control>
          </Form.Group>
        </Form>
        <small className="text-muted">
          Select a class to create a page preconfigured for that class, or leave blank for a generic page.
        </small>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => onCreate(selectedClassId)}>
          Create Page
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
