import React from 'react';
import { NavDropdown } from 'react-bootstrap';
import { bugReportURL } from '../../../constant';
import { ModalContentType } from '../../modals/application-modal-types';
import { useAppDispatch } from '../../store/hooks';
import { showModal } from '../../../services/modal/modalSlice';

export const HelpMenu: React.FC = () => {
  const dispatch = useAppDispatch();

  return (
    <NavDropdown id="file-menu-item" title="Help" style={{ paddingTop: 0, paddingBottom: 0 }}>
      <NavDropdown.Item onClick={() => dispatch(showModal({ type: ModalContentType.HelpModelingModal, size: 'lg' }))}>
        How does this Editor work?
      </NavDropdown.Item>
      <NavDropdown.Item onClick={() => dispatch(showModal({ type: ModalContentType.InformationModal }))}>
        About BESSER
      </NavDropdown.Item>
      <a href={bugReportURL} target="_blank" className="dropdown-item">
        Report a Problem
      </a>
    </NavDropdown>
  );
};
