import React from 'react';
import { FolderKanban } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { CommunityMenu } from './menus/CommunityMenu';
import { DeployMenu } from './menus/DeployMenu';
import { FileMenu } from './menus/FileMenu';
import { GenerateMenu } from './menus/GenerateMenu';
import { MobileNavigation } from './menus/MobileNavigation';
import { TopBarUtilities } from './menus/TopBarUtilities';
import type { WorkspaceTopBarProps } from './topbar-types';

const WorkspaceTopBarInner: React.FC<WorkspaceTopBarProps> = ({
  isDarkTheme,
  headerBackgroundClass,
  outlineButtonClass,
  primaryGenerateClass,
  showQualityCheck,
  generatorMode,
  isGenerating,
  locationPath,
  activeUmlType,
  isAuthenticated,
  username,
  githubLoading,
  hasProject,
  isDeploymentAvailable,
  onOpenProjectHub,
  onOpenTemplateDialog,
  onExportProject,
  onImportSingleDiagram,
  onOpenAssistantImportImage,
  onOpenAssistantImportKg,
  onOpenProjectPreview,
  onGenerate,
  onQualityCheck,
  onToggleTheme,
  onGitHubLogin,
  onGitHubLogout,
  onOpenGitHubSidebar,
  hasStarred,
  starLoading,
  onToggleStar,
  onOpenDeployDialog,
  onOpenHelpDialog,
  onOpenAboutDialog,
  onOpenFeedback,
  onOpenKeyboardShortcuts,
  onShowWelcomeGuide,
  activeDiagramType,
  onSwitchUml,
  onSwitchDiagramType,
  onNavigate,
  projectNameDraft,
  onProjectNameDraftChange,
  onProjectRename,
}) => {
  return (
    <header className={`relative z-20 animate-slide-in-down px-4 py-2 sm:px-6 ${headerBackgroundClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenProjectHub}
            aria-label="Open project hub"
            className="group flex shrink-0 items-center p-0 text-left transition-opacity hover:opacity-85"
          >
            <img
              src="/images/logo.png"
              alt="BESSER"
              className={`h-10 w-auto ${isDarkTheme ? 'brightness-0 invert' : 'brightness-0'}`}
            />
          </button>
          <div className="hidden items-center gap-1.5 lg:flex">
            <FolderKanban className="size-4 shrink-0 text-muted-foreground" />
            <Input
              value={projectNameDraft}
              onChange={(event) => onProjectNameDraftChange(event.target.value)}
              onBlur={onProjectRename}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur();
                }
              }}
              className="h-7 w-36 border-none bg-transparent px-1 py-0 text-sm font-medium shadow-none focus-visible:ring-0"
              placeholder="Project name"
            />
          </div>
        </div>

        <div className="flex items-center gap-1 xl:gap-2">
          <FileMenu
            outlineButtonClass={outlineButtonClass}
            hasProject={hasProject}
            onOpenProjectHub={onOpenProjectHub}
            onOpenTemplateDialog={onOpenTemplateDialog}
            onExportProject={onExportProject}
            onImportSingleDiagram={onImportSingleDiagram}
            onOpenAssistantImportImage={onOpenAssistantImportImage}
            onOpenAssistantImportKg={onOpenAssistantImportKg}
            onOpenProjectPreview={onOpenProjectPreview}
          />
          <GenerateMenu
            mode={generatorMode}
            isGenerating={isGenerating}
            primaryGenerateClass={primaryGenerateClass}
            onGenerate={onGenerate}
            onSwitchDiagramType={onSwitchDiagramType}
          />
          <DeployMenu
            outlineButtonClass={outlineButtonClass}
            isAuthenticated={isAuthenticated}
            githubLoading={githubLoading}
            isDeploymentAvailable={isDeploymentAvailable}
            onGitHubLogin={onGitHubLogin}
            onOpenDeployDialog={onOpenDeployDialog}
          />
          <CommunityMenu
            outlineButtonClass={outlineButtonClass}
            onOpenFeedback={onOpenFeedback}
            onOpenHelpDialog={onOpenHelpDialog}
            onOpenAboutDialog={onOpenAboutDialog}
            onOpenKeyboardShortcuts={onOpenKeyboardShortcuts}
            onShowWelcomeGuide={onShowWelcomeGuide}
          />
          <TopBarUtilities
            showQualityCheck={showQualityCheck}
            outlineButtonClass={outlineButtonClass}
            isDarkTheme={isDarkTheme}
            isAuthenticated={isAuthenticated}
            username={username}
            githubLoading={githubLoading}
            hasStarred={hasStarred}
            starLoading={starLoading}
            onQualityCheck={onQualityCheck}
            onToggleTheme={onToggleTheme}
            onGitHubLogin={onGitHubLogin}
            onGitHubLogout={onGitHubLogout}
            onOpenGitHubSidebar={onOpenGitHubSidebar}
            onToggleStar={onToggleStar}
          />
        </div>
      </div>
      <MobileNavigation
        locationPath={locationPath}
        activeUmlType={activeUmlType}
        activeDiagramType={activeDiagramType}
        isDarkTheme={isDarkTheme}
        onSwitchUml={onSwitchUml}
        onSwitchDiagramType={onSwitchDiagramType}
        onNavigate={onNavigate}
      />
    </header>
  );
};

export const WorkspaceTopBar = React.memo(WorkspaceTopBarInner);
