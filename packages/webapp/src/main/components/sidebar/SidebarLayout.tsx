import React from 'react';
import { DiagramTypeSidebar } from './DiagramTypeSidebar';
import styled from 'styled-components';

interface SidebarLayoutProps {
  children: React.ReactNode;
}

const LayoutContainer = styled.div`
  display: flex;
  min-height: calc(100vh - 60px);
  position: relative;
  background-color: var(--apollon-background, #ffffff);
`;

const MainContent = styled.div`
  flex: 1;
  margin-left: 60px; // Space for the fixed sidebar
  min-height: calc(100vh - 60px);
  overflow-x: auto;
  overflow-y: auto;
  position: relative;
  
  // Ensure content doesn't overlap with sidebar
  @media (max-width: 768px) {
    margin-left: 0;
  }
`;

const ContentWrapper = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
`;

export const SidebarLayout: React.FC<SidebarLayoutProps> = ({ children }) => {
  return (
    <LayoutContainer>
      <DiagramTypeSidebar />
      <MainContent>
        <ContentWrapper>
          {children}
        </ContentWrapper>
      </MainContent>
    </LayoutContainer>
  );
};
