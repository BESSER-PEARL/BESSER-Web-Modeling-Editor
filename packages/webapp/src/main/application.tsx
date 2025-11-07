import React, { useMemo, useState, useEffect } from 'react';
import { ApplicationBar } from './components/application-bar/application-bar';
import { ApollonEditorComponent } from './components/apollon-editor-component/ApollonEditorComponent';
import { ApollonEditor } from '@besser/wme';
import { POSTHOG_HOST, POSTHOG_KEY, localStorageLatestProject } from './constant';
import { ApollonEditorProvider } from './components/apollon-editor-component/apollon-editor-context';
import { FirefoxIncompatibilityHint } from './components/incompatability-hints/firefox-incompatibility-hint';
import { ErrorPanel } from './components/error-handling/error-panel';
import { BrowserRouter, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { ApplicationModal } from './components/modals/application-modal';
import { ToastContainer } from 'react-toastify';
import { PostHogProvider } from 'posthog-js/react';
import { ApplicationStore } from './components/store/application-store';
import { ApollonEditorComponentWithConnection } from './components/apollon-editor-component/ApollonEditorComponentWithConnection';
import { VersionManagementSidebar } from './components/version-management-sidebar/VersionManagementSidebar';
import { SidebarLayout } from './components/sidebar/SidebarLayout';
import { HomeModal } from './components/home/HomeModal';
import { ProjectSettingsScreen } from './components/project/ProjectSettingsScreen';
import { TeamPage } from './components/team/TeamPage';
import { useProject } from './hooks/useProject';
import {  GraphicalUIEditor } from './components/grapesjs-editor';
import { UMLAgentModeling } from './components/uml-agent-widget/UMLAgentModeling';

const postHogOptions = {
  api_host: POSTHOG_HOST,
};

function AppContentInner() {
  const [editor, setEditor] = useState<ApollonEditor>();
  const [showHomeModal, setShowHomeModal] = useState(false);
  const [hasCheckedForProject, setHasCheckedForProject] = useState(false);
  const { currentProject, loadProject } = useProject();
  const location = useLocation();
  
  // Check if current path contains a token (collaboration route)
  const hasTokenInUrl = location.pathname !== '/' && 
                       location.pathname !== '/project-settings' && 
                       location.pathname !== '/teampage' &&
                       location.pathname !== '/graphical-ui-editor';
  
  const handleSetEditor = (newEditor: ApollonEditor) => {
    setEditor(newEditor);
  };
  
  // Check for latest project on app startup
  useEffect(() => {
    const checkForLatestProject = async () => {
      if (hasCheckedForProject) return;
      
      // If there's a token in the URL, don't show home modal
      if (hasTokenInUrl) {
        setShowHomeModal(false);
        setHasCheckedForProject(true);
        return;
      }
      
      const latestProjectId = localStorage.getItem(localStorageLatestProject);
      
      if (latestProjectId) {
        try {
          await loadProject(latestProjectId);
          setShowHomeModal(false);
        } catch (error) {
          // If loading fails, show the modal
          setShowHomeModal(true);
        }
      } else {
        // No latest project, show modal
        setShowHomeModal(true);
      }
      
      setHasCheckedForProject(true);
    };
    
    checkForLatestProject();
  }, [loadProject, hasCheckedForProject, hasTokenInUrl]);
  
  // Additional effect to handle currentProject changes
  useEffect(() => {
    if (hasCheckedForProject) {
      // If there's a token in the URL, don't show home modal
      if (hasTokenInUrl) {
        setShowHomeModal(false);
      } else if (!currentProject) {
        setShowHomeModal(true);
      } else {
        setShowHomeModal(false);
      }
    }
  }, [currentProject, hasCheckedForProject, hasTokenInUrl]);
  
  const isFirefox = useMemo(() => /Firefox/i.test(navigator.userAgent), []);

  return (
    <ApollonEditorProvider value={{ editor, setEditor: handleSetEditor }}>
      <ApplicationBar onOpenHome={() => setShowHomeModal(true)} />
      <ApplicationModal />
      <VersionManagementSidebar />
      {/* Home Modal */}
      <HomeModal 
        show={showHomeModal} 
        onHide={() => {
          // Only allow closing if there's a current project or if there's a token in URL
          if (currentProject || hasTokenInUrl) {
            setShowHomeModal(false);
          }
        }} 
      />
      {/* {isFirefox && <FirefoxIncompatibilityHint />} */}
      <Routes>
        {/* Collaboration route with token */}
        {/* <Route 
          path="/:token" 
          element={
            // <SidebarLayout>  No collaboration support yet
              <ApollonEditorComponentWithConnection />
            // </SidebarLayout>
          } 
        /> */}
        
        {/* Main editor route */}
        <Route 
          path="/" 
          element={
            <SidebarLayout>
              <ApollonEditorComponent />
            </SidebarLayout>
          } 
        />


        {/* GraphicalUIEditor Studio Editor route - Multi-page support */}
        <Route 
          path="/graphical-ui-editor"
          element={
            <SidebarLayout>
              <GraphicalUIEditor />
            </SidebarLayout>
          } 
        />


        {/* Project settings route */}
        <Route 
          path="/project-settings" 
          element={
            <SidebarLayout>
              <ProjectSettingsScreen />
            </SidebarLayout>
          } 
        />
        
        {/* Team page route */}
        <Route path="/teampage" element={<TeamPage />} />
      </Routes>
      <ErrorPanel />
      <UMLAgentModeling />
      <ToastContainer />
    </ApollonEditorProvider>
  );
}

function AppContent() {
  return (
    <BrowserRouter>
      <AppContentInner />
    </BrowserRouter>
  );
}

export function RoutedApplication() {
  return (
    <PostHogProvider apiKey={POSTHOG_KEY} options={postHogOptions}>
      <ApplicationStore>
        <AppContent />
      </ApplicationStore>
    </PostHogProvider>
  );
}
