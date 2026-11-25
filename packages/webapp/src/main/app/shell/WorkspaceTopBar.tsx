import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderKanban, Menu, Users, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GUI_PERSONALIZE_EVENT } from '../../shared/constants/gui-personalize-event';
import { LanguageSelector } from './LanguageSelector';
import { DeployMenu } from './menus/DeployMenu';
import { FileMenu } from './menus/FileMenu';
import { GenerateMenu } from './menus/GenerateMenu';
import { GuiVariantSelector } from './menus/GuiVariantSelector';
import { HelpMenu } from './menus/HelpMenu';
import { MoreMenu } from './menus/MoreMenu';
import { TopBarUtilities } from './menus/TopBarUtilities';
import type { WorkspaceTopBarProps } from './topbar-types';

const computeVariantLabelWidth = (label: string) =>
  Math.min(Math.max(100, label.length * 7.5 + 48), 280);

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
  deployGoesLive,
  onOpenProjectHub,
  onOpenTemplateDialog,
  onExportProject,
  onImportSingleDiagram,
  onImportBpmnDiagram,
  onOpenAssistantImportImage,
  onOpenAssistantImportKg,
  onImportOwl,
  onGenerate,
  onOpenPersonalizeDialog,
  onOpenRecommendPersonalizationDialog,
  onOpenPersonalizationOverview,
  onQualityCheck,
  onSemanticCheck,
  qualityCheckState,
  showAgentVariantSelector,
  agentVariantOptions,
  activeAgentVariantId,
  onAgentVariantChange,
  onToggleTheme,
  onGitHubLogin,
  onGitHubLogout,
  onRepoOpened,
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
  onDeriveComponentDiagram,
  onDeriveDeploymentDiagram,
  onGenerateDockerCompose,
  projectNameDraft,
  onProjectNameDraftChange,
  onProjectRename,
  isMobileNavOpen,
  onOpenMobileNav,
  mobileNavTriggerRef,
}) => {
  const { t } = useTranslation();

  // Track header width so we can shift collapse thresholds when the variant
  // selector is present and consuming variable amounts of space.
  const headerRef = useRef<HTMLElement>(null);
  const [headerWidth, setHeaderWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1920,
  );
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setHeaderWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const activeVariantLabel = !activeAgentVariantId
    ? t('topbar.baseAgentModel')
    : (agentVariantOptions?.find((o) => o.id === activeAgentVariantId)?.label ?? t('topbar.baseAgentModel'));
  const selectWidthPx = computeVariantLabelWidth(activeVariantLabel);

  // Shift the xl (1280px) and 2xl (1536px) collapse breakpoints upward by
  // however many pixels the variant selector exceeds a short-label baseline.
  // When no variant selector: pass undefined → CSS breakpoints take over.
  const BASELINE_SELECT_WIDTH = 100;
  const extraVariantWidth = showAgentVariantSelector
    ? Math.max(0, selectWidthPx - BASELINE_SELECT_WIDTH)
    : 0;
  const showXlLabels: boolean | undefined = showAgentVariantSelector
    ? headerWidth >= 1280 + extraVariantWidth
    : undefined;
  const show2xlLabels: boolean | undefined = showAgentVariantSelector
    ? headerWidth >= 1536 + extraVariantWidth
    : undefined;

  return (
    <header ref={headerRef} className={`relative z-20 px-3 py-2 sm:px-6 ${headerBackgroundClass}`}>
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
          <div className="hidden min-w-0 items-center gap-1.5 lg:flex">
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
              className="h-7 w-40 min-w-0 rounded-md border-none bg-transparent px-1.5 py-0 text-sm font-medium shadow-none transition-colors duration-150 hover:bg-foreground/[0.05] focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-0"
              placeholder={t('topbar.projectName')}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1 xl:gap-1.5">
          <FileMenu
            outlineButtonClass={outlineButtonClass}
            showXlLabels={showXlLabels}
            hasProject={hasProject}
            activeDiagramType={activeDiagramType}
            onOpenProjectHub={onOpenProjectHub}
            onOpenTemplateDialog={onOpenTemplateDialog}
            onExportProject={onExportProject}
            onImportSingleDiagram={onImportSingleDiagram}
            onImportBpmnDiagram={onImportBpmnDiagram}
            onOpenAssistantImportImage={onOpenAssistantImportImage}
            onOpenAssistantImportKg={onOpenAssistantImportKg}
            onImportOwl={onImportOwl}
          />
          <GenerateMenu
            mode={generatorMode}
            showXlLabels={showXlLabels}
            isGenerating={isGenerating}
            primaryGenerateClass={primaryGenerateClass}
            activeDiagramType={activeDiagramType}
            onGenerate={onGenerate}
            onSwitchDiagramType={onSwitchDiagramType}
            onDeriveComponentDiagram={onDeriveComponentDiagram}
            onDeriveDeploymentDiagram={onDeriveDeploymentDiagram}
            onGenerateDockerCompose={onGenerateDockerCompose}
          />
          {activeDiagramType === 'AgentDiagram' && onOpenPersonalizeDialog && (
            <Button
              variant="outline"
              className={outlineButtonClass}
              onClick={() => {
                onOpenPersonalizeDialog();
              }}
              title={t('personalize.title')}
            >
              <Users className="size-4" />
              <span className={showXlLabels !== undefined ? (showXlLabels ? '' : 'hidden') : 'hidden xl:inline'}>{t('personalize.title')}</span>
            </Button>
          )}
          {activeDiagramType === 'GUINoCodeDiagram' && (
            <Button
              variant="outline"
              className={outlineButtonClass}
              onClick={() => {
                window.dispatchEvent(new CustomEvent(GUI_PERSONALIZE_EVENT));
              }}
              title={t('personalize.title')}
            >
              <Users className="size-4" />
              <span className={showXlLabels !== undefined ? (showXlLabels ? '' : 'hidden') : 'hidden xl:inline'}>{t('personalize.title')}</span>
            </Button>
          )}
          {activeDiagramType === 'GUINoCodeDiagram' && <GuiVariantSelector />}
          {activeDiagramType === 'UserDiagram' && onOpenPersonalizationOverview && (
            <Button
              variant="outline"
              className={outlineButtonClass}
              onClick={() => {
                onOpenPersonalizationOverview();
              }}
              title={t('personalizationOverview.title')}
            >
              <LayoutGrid className="size-4" />
              <span className={showXlLabels !== undefined ? (showXlLabels ? '' : 'hidden') : 'hidden xl:inline'}>{t('personalizationOverview.title')}</span>
            </Button>
          )}
          {/* Below sm these fold into the More menu */}
          <div className="hidden sm:contents">
            <DeployMenu
              outlineButtonClass={outlineButtonClass}
              isAuthenticated={isAuthenticated}
              githubLoading={githubLoading}
              isDeploymentAvailable={isDeploymentAvailable}
              deployGoesLive={deployGoesLive}
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
            onSemanticCheck={onSemanticCheck}
            showAgentVariantSelector={showAgentVariantSelector}
            agentVariantOptions={agentVariantOptions}
            activeAgentVariantId={activeAgentVariantId}
            onAgentVariantChange={onAgentVariantChange}
            showXlLabels={showXlLabels}
            show2xlLabels={show2xlLabels}
            onToggleTheme={onToggleTheme}
            onGitHubLogin={onGitHubLogin}
            onGitHubLogout={onGitHubLogout}
            onToggleStar={onToggleStar}
            onRepoOpened={onRepoOpened}
            onSwitchDiagramType={onSwitchDiagramType}
          />
          <div className="hidden sm:contents">
            <LanguageSelector outlineButtonClass={outlineButtonClass} />
          </div>
          <MoreMenu
            outlineButtonClass={outlineButtonClass}
            isDarkTheme={isDarkTheme}
            isAuthenticated={isAuthenticated}
            githubLoading={githubLoading}
            isDeploymentAvailable={isDeploymentAvailable || !!deployGoesLive}
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
