import React from 'react';
import { NavDropdown } from 'react-bootstrap';
import { bugReportURL } from '../../../constant';
import { ModalContentType } from '../../modals/application-modal-types';
import { useAppDispatch } from '../../store/hooks';
import { showModal } from '../../../services/modal/modalSlice';

const githubRepoURL = 'https://github.com/BESSER-PEARL/BESSER';
const contributingGuideURL = 'https://github.com/BESSER-PEARL/BESSER/blob/main/CONTRIBUTING.md';
const userEvaluationSurveyURL = 'https://docs.google.com/forms/d/e/1FAIpQLSdhYVFFu8xiFkoV4u6Pgjf5F7-IS_W7aTj34N5YS2L143vxoQ/viewform';

export const CommunityMenu: React.FC = () => {
  const dispatch = useAppDispatch();

  return (
    <NavDropdown id="community-menu-item" title="Community" style={{ paddingTop: 0, paddingBottom: 0 }}>
      <a href={contributingGuideURL} target="_blank" className="dropdown-item">
        Contribute
      </a>
      <a href={githubRepoURL} target="_blank" className="dropdown-item">
        GitHub Repository
      </a>
      <NavDropdown.Divider />
      <NavDropdown.Item onClick={() => dispatch(showModal({ type: ModalContentType.FeedbackModal }))}>
        Send Feedback
      </NavDropdown.Item>
      <a href={userEvaluationSurveyURL} target="_blank" className="dropdown-item">
        User Evaluation Survey
      </a>
      <a href={bugReportURL} target="_blank" className="dropdown-item">
        Report a Problem
      </a>
    </NavDropdown>
  );
};
