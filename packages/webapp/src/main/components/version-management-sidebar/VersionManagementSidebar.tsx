import React from 'react';
import styled from 'styled-components';
import { useAppSelector } from '../store/hooks';
import { selectDisplaySidebar } from '../../services/version-management/versionManagementSlice';
import { TimelineHeader } from './TimelineHeader';
import { Timeline } from './timeline/Timeline';

const TimelineContainer = styled.div<{ $isOpen: boolean }>`
  z-index: 1;
  position: fixed;
  top: 0;
  right: 0;
  height: 100%;
  width: ${(props) => (props.$isOpen ? '250px' : '0')}; /* 0 width when closed */
  background-color: var(--apollon-background);
  border-left: ${(props) => (props.$isOpen ? '1px solid #e6e6e6' : 'none')};
  overflow-y: auto;
  transition: width 0.3s ease;
`;

export const VersionManagementSidebar: React.FC = () => {
  const isVersionManagementSidebarOpen = useAppSelector(selectDisplaySidebar);

  if (!isVersionManagementSidebarOpen) {
    return null;
  }

  return (
    <TimelineContainer $isOpen={isVersionManagementSidebarOpen}>
      <TimelineHeader />
      <Timeline />
    </TimelineContainer>
  );
};
