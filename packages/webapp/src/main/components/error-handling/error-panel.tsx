import React from 'react';
import styled from 'styled-components';

import { ErrorMessage } from './error-message';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { dismissError } from '../../services/error-management/errorManagementSlice';
import { selectDisplaySidebar } from '../../services/version-management/versionManagementSlice';

const MainContent = styled.div<{ $isSidebarOpen: boolean }>`
  transition: margin-right 0.3s ease;
  margin-right: ${(props) => (props.$isSidebarOpen ? '250px' : '0')}; /* Adjust based on sidebar width */
`;

export const ErrorPanel: React.FC = () => {
  const errors = useAppSelector((state) => state.errors);
  const isSidebarOpen = useAppSelector(selectDisplaySidebar);
  const dispatch = useAppDispatch();
  return (
    <MainContent $isSidebarOpen={isSidebarOpen}>
      {errors.map((error, index) => (
        <ErrorMessage error={error} onClose={(apollonError) => dispatch(dismissError(apollonError.id))} key={index} />
      ))}
    </MainContent>
  );
};
