import React from 'react';
import { Modal, Card, Row, Col, Button } from 'react-bootstrap';
import { ModalContentProps, ModalContentType } from '../application-modal-types';
import { FileText, PlusCircle } from 'react-bootstrap-icons';
import { useAppDispatch } from '../../store/hooks';
import { showModal } from '../../../services/modal/modalSlice';
import styled from 'styled-components';

const CardButton = styled(Card)`
  cursor: pointer;
  transition: box-shadow 0.2s, border-color 0.2s, background 0.2s;
  &:hover, &:focus {
    box-shadow: 0 0 0 0.2rem rgba(0,123,255,.15), 0 4px 16px rgba(0,0,0,0.10);
    border-color: #007bff;
    background: #f8f9fa;
  }
`;

export const StartProjectModal: React.FC<ModalContentProps> = ({ close }) => {
  const dispatch = useAppDispatch();

  const handleBlankProject = () => {
    close();
    setTimeout(() => {
      dispatch(showModal({ type: ModalContentType.CreateProjectModal }));
    }, 0);
  };

  const handleSpreadsheet = () => {
    dispatch(showModal({ type: ModalContentType.StartFromSpreadsheetModal }));
  };

  return (
    <>
      <Modal.Header closeButton>
        <Modal.Title>Start a New Project</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Row>
          <Col md={6} className="mb-3">
            <CardButton className="h-100 shadow-sm" onClick={handleBlankProject} tabIndex={0} role="button">
              <Card.Body className="d-flex flex-column align-items-center justify-content-center">
                <PlusCircle size={40} className="mb-2 text-primary" />
                <Card.Title>Blank Project</Card.Title>
                <Card.Text className="text-muted text-center small">
                  Start from scratch and add diagrams manually.
                </Card.Text>
              </Card.Body>
            </CardButton>
          </Col>
          <Col md={6} className="mb-3">
            <CardButton className="h-100 shadow-sm" onClick={handleSpreadsheet} tabIndex={0} role="button">
              <Card.Body className="d-flex flex-column align-items-center justify-content-center">
                <FileText size={40} className="mb-2 text-success" />
                <Card.Title>From Spreadsheet</Card.Title>
                <Card.Text className="text-muted text-center small">
                  Import a spreadsheet (CSV/Excel) to generate your initial class diagram.
                </Card.Text>
              </Card.Body>
            </CardButton>
          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={close}>
          Cancel
        </Button>
      </Modal.Footer>
    </>
  );
};
