import React, { ReactElement, useState } from 'react';
import { Alert } from 'react-bootstrap';
import { useAppSelector } from '../store/hooks';
import { selectDisplaySidebar } from '../../services/version-management/versionManagementSlice';
import { styled } from 'styled-components';

const MainContent = styled.div<{ $isSidebarOpen: boolean }>`
  transition: margin-right 0.3s ease;
  margin-right: ${(props) => (props.$isSidebarOpen ? '250px' : '0')}; /* Adjust based on sidebar width */
`;

export const FirefoxIncompatibilityHint: React.FC = (): ReactElement | null => {
  const [show, setShow] = useState(true);
  const isSidebarOpen = useAppSelector(selectDisplaySidebar);
  return (
    <MainContent $isSidebarOpen={isSidebarOpen}>
      <Alert variant="warning" onClose={() => setShow(false)} dismissible show={show}>
        {' '}
        Firefox is not fully supported - some features might not work. Please use another browser (latest Chrome or
        Safari) to make sure all features are working as expected.
      </Alert>
    </MainContent>
  );
};
