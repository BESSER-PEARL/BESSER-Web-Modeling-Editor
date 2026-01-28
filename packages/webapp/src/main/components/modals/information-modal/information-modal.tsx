import React from 'react';
import { Button, Modal } from 'react-bootstrap';

import {
  besserLibraryRepositoryLink,
  besserLibraryVersion,
  besserWMERepositoryLink,
  appVersion,
} from '../../../application-constants';
import { ModalContentProps } from '../application-modal-types';

export const InformationModal: React.FC<ModalContentProps> = ({ close }) => {
  return (
    <>
      <Modal.Header closeButton>
        <Modal.Title>Information about BESSER</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <table style={{ width: '100%' }}>
          <tbody>
          <tr>
              <td>BESSER Library:</td>
              <td>
                <a href={besserLibraryRepositoryLink} target="_blank">
                  BESSER library
                </a>{' '}
                {/* {besserLibraryVersion} */}
              </td>
            </tr>
            <tr>
              <td>Version:</td>
              <td>
                <a href={besserWMERepositoryLink} target="_blank">
                  BESSER Web Modeling Editor{' '}
                </a>
                {/* {appVersion} */}
              </td>
            </tr>

          </tbody>
        </table>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={close}>
          Close
        </Button>
      </Modal.Footer>
    </>
  );
};
