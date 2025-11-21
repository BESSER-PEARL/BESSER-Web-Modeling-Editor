import React from 'react';
import { Button, Modal, Form } from 'react-bootstrap';
import { ModalContentProps } from '../application-modal-types';

export const StartFromSpreadsheetModal: React.FC<ModalContentProps> = ({ close }) => {
  // Placeholder for spreadsheet upload logic
  return (
    <>
      <Modal.Header closeButton>
        <Modal.Title>Start Project from Spreadsheet</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Upload Spreadsheet (CSV or Excel)</Form.Label>
            <Form.Control type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" />
            <Form.Text className="text-muted">
              Choose a CSV or Excel file to generate your initial class diagram.
            </Form.Text>
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={close}>
          Cancel
        </Button>
        <Button variant="primary" disabled>
          Import (Coming Soon)
        </Button>
      </Modal.Footer>
    </>
  );
};
