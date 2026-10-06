import React from 'react';
import { useTranslation } from 'react-i18next';
import { FolderKanban, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LanguageSelector } from './LanguageSelector';
import { DeployMenu } from './menus/DeployMenu';
import { FileMenu } from './menus/FileMenu';
import { GenerateMenu } from './menus/GenerateMenu';
import { HelpMenu } from './menus/HelpMenu';
import { MoreMenu } from './menus/MoreMenu';
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
  isAuthenticated,
  username,
  githubLoading,
  hasProject,
  isDeploymentAvailable,
  onOpenProjectHub,
  onOpenTemplateDialog,
  onExportProject,
  onImportSingleDiagram,
  onImportBpmnDiagram,
  onOpenAssistantImportImage,
  onOpenAssistantImportKg,
  onOpenProjectPreview,
  onGenerate,
  onQualityCheck,
  qualityCheckState,
  showAgentVariantSelector,
  agentVariantOptions,
  activeAgentVariantId,
  onAgentVariantChange,
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
  onSwitchDiagramType,
  projectNameDraft,
  onProjectNameDraftChange,
  onProjectRename,
  isMobileNavOpen,
  onOpenMobileNav,
  mobileNavTriggerRef,
}) => {
  const { t } = useTranslation();
  return (
    <header className={`relative z-20 px-3 py-2 sm:px-6 ${headerBackgroundClass}`}>
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <Button
            ref={mobileNavTriggerRef}
            variant="ghost"
            size="sm"
            className={`shrink-0 px-2 md:hidden ${outlineButtonClass}`}
            onClick={onOpenMobileNav}
            aria-label={t('shell.nav.open')}
            aria-haspopup="dialog"
            aria-expanded={isMobileNavOpen}
          >
            <Menu className="size-5" aria-hidden="true" />
          </Button>
          <button
            type="button"
            onClick={() => onOpenProjectHub()}
            aria-label={t('topbar.openProjectHub')}
            className="group flex shrink-0 items-center rounded-md p-0 text-left transition-opacity duration-150 hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
          >
            <img
              src="/images/logo.png"
              alt="BESSER"
              width={151}
              height={40}
              className={`h-8 w-auto sm:h-10 ${isDarkTheme ? 'brightness-0 invert' : 'brightness-0'}`}
            />
          </button>
          <div className="hidden items-center gap-1.5 lg:flex">
            <FolderKanban className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Input
              aria-label={t('topbar.projectName')}
              autoComplete="off"
              spellCheck={false}
              value={projectNameDraft}
              onChange={(event) => onProjectNameDraftChange(event.target.value)}
              onBlur={onProjectRename}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur();
                }
              }}
              className="h-7 w-40 rounded-md border-none bg-transparent px-1.5 py-0 text-sm font-medium shadow-none transition-colors duration-150 hover:bg-foreground/[0.05] focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-0"
              placeholder={t('topbar.projectName')}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1 xl:gap-1.5">
          <FileMenu
            outlineButtonClass={outlineButtonClass}
            hasProject={hasProject}
            activeDiagramType={activeDiagramType}
            onOpenProjectHub={onOpenProjectHub}
            onOpenTemplateDialog={onOpenTemplateDialog}
            onExportProject={onExportProject}
            onImportSingleDiagram={onImportSingleDiagram}
            onImportBpmnDiagram={onImportBpmnDiagram}
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
          {/* Below sm these fold into the More menu */}
          <div className="hidden sm:contents">
            <DeployMenu
              outlineButtonClass={outlineButtonClass}
              isAuthenticated={isAuthenticated}
              githubLoading={githubLoading}
              isDeploymentAvailable={isDeploymentAvailable}
              onGitHubLogin={onGitHubLogin}
              onOpenDeployDialog={onOpenDeployDialog}
            />
            <HelpMenu
              outlineButtonClass={outlineButtonClass}
              onOpenHelpDialog={onOpenHelpDialog}
              onOpenAboutDialog={onOpenAboutDialog}
              onOpenKeyboardShortcuts={onOpenKeyboardShortcuts}
              onShowWelcomeGuide={onShowWelcomeGuide}
              onOpenFeedback={onOpenFeedback}
            />
          </div>
          <span aria-hidden="true" className="mx-0.5 hidden h-6 w-px bg-border/60 sm:block" />
          <TopBarUtilities
            showQualityCheck={showQualityCheck}
            outlineButtonClass={outlineButtonClass}
            isDarkTheme={isDarkTheme}
            isAuthenticated={isAuthenticated}
            username={username}
            githubLoading={githubLoading}
            hasStarred={hasStarred}
            starLoading={starLoading}
            qualityCheckState={qualityCheckState}
            onQualityCheck={onQualityCheck}
            showAgentVariantSelector={showAgentVariantSelector}
            agentVariantOptions={agentVariantOptions}
            activeAgentVariantId={activeAgentVariantId}
            onAgentVariantChange={onAgentVariantChange}
            onToggleTheme={onToggleTheme}
            onGitHubLogin={onGitHubLogin}
            onGitHubLogout={onGitHubLogout}
            onOpenGitHubSidebar={onOpenGitHubSidebar}
            onToggleStar={onToggleStar}
          />
          <div className="hidden sm:contents">
            <LanguageSelector outlineButtonClass={outlineButtonClass} />
          </div>
          <MoreMenu
            outlineButtonClass={outlineButtonClass}
            isDarkTheme={isDarkTheme}
            isAuthenticated={isAuthenticated}
            githubLoading={githubLoading}
            isDeploymentAvailable={isDeploymentAvailable}
            onGitHubLogin={onGitHubLogin}
            onGitHubLogout={onGitHubLogout}
            onOpenDeployDialog={onOpenDeployDialog}
            onOpenHelpDialog={onOpenHelpDialog}
            onOpenAboutDialog={onOpenAboutDialog}
            onOpenKeyboardShortcuts={onOpenKeyboardShortcuts}
            onOpenFeedback={onOpenFeedback}
            onToggleTheme={onToggleTheme}
          />
        </div>
      </div>
    </header>
  );
};

export const WorkspaceTopBar = React.memo(WorkspaceTopBarInner);
