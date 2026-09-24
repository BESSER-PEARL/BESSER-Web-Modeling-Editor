import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderKanban, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getPostHog } from '../../shared/services/analytics/lazy-analytics';
import { LanguageSelector } from './LanguageSelector';
import { CommunityMenu } from './menus/CommunityMenu';
import { DeployMenu } from './menus/DeployMenu';
import { FileMenu } from './menus/FileMenu';
import { GenerateMenu } from './menus/GenerateMenu';
import { HelpMenu } from './menus/HelpMenu';
import { MobileNavigation } from './menus/MobileNavigation';
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
  onImportBpmnDiagram,
  onOpenAssistantImportImage,
  onOpenAssistantImportKg,
  onOpenProjectPreview,
  onGenerate,
  onOpenPersonalizeDialog,
  onOpenRecommendPersonalizationDialog,
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
  onOpenStudyDeployDialog,
  onOpenHelpDialog,
  onOpenAboutDialog,
  onOpenFeedback,
  onOpenKeyboardShortcuts,
  onShowWelcomeGuide,
  activeDiagramType,
  perspectives,
  onSwitchUml,
  onSwitchDiagramType,
  onNavigate,
  projectNameDraft,
  onProjectNameDraftChange,
  onProjectRename,
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
    <header ref={headerRef} className={`relative z-20 animate-slide-in-down px-4 py-2 sm:px-6 ${headerBackgroundClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenProjectHub}
            aria-label={t('topbar.openProjectHub')}
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
              placeholder={t('topbar.projectName')}
            />
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-1 xl:gap-1.5">
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
            onOpenProjectPreview={onOpenProjectPreview}
          />
          <GenerateMenu
            mode={generatorMode}
            showXlLabels={showXlLabels}
            isGenerating={isGenerating}
            primaryGenerateClass={primaryGenerateClass}
            activeDiagramType={activeDiagramType}
            onGenerate={onGenerate}
            onSwitchDiagramType={onSwitchDiagramType}
          />
          {activeDiagramType === 'AgentDiagram' && onOpenPersonalizeDialog && (
            <Button
              variant="outline"
              className={outlineButtonClass}
              onClick={() => {
                getPostHog()?.capture('personalize_dialog_opened', { diagram_type: activeDiagramType });
                onOpenPersonalizeDialog();
              }}
              title={t('personalize.title')}
            >
              <Users className="size-4" />
              <span className={showXlLabels !== undefined ? (showXlLabels ? '' : 'hidden') : 'hidden xl:inline'}>{t('personalize.title')}</span>
            </Button>
          )}
          {activeDiagramType === 'UserDiagram' && onOpenRecommendPersonalizationDialog && (
            <Button
              variant="outline"
              className={outlineButtonClass}
              onClick={() => {
                getPostHog()?.capture('recommend_personalization_opened', { diagram_type: activeDiagramType });
                onOpenRecommendPersonalizationDialog();
              }}
              title={t('recommendPersonalization.title')}
            >
              <Sparkles className="size-4" />
              <span className={showXlLabels !== undefined ? (showXlLabels ? '' : 'hidden') : 'hidden xl:inline'}>{t('recommendPersonalization.title')}</span>
            </Button>
          )}
          <DeployMenu
            outlineButtonClass={outlineButtonClass}
            showXlLabels={showXlLabels}
            isAuthenticated={isAuthenticated}
            githubLoading={githubLoading}
            isDeploymentAvailable={isDeploymentAvailable}
            onGitHubLogin={onGitHubLogin}
            onOpenDeployDialog={onOpenDeployDialog}
            onOpenStudyDeployDialog={onOpenStudyDeployDialog}
          />
          <CommunityMenu outlineButtonClass={outlineButtonClass} showXlLabels={showXlLabels} onOpenFeedback={onOpenFeedback} />
          <HelpMenu
            outlineButtonClass={outlineButtonClass}
            showXlLabels={showXlLabels}
            onOpenHelpDialog={onOpenHelpDialog}
            onOpenAboutDialog={onOpenAboutDialog}
            onOpenKeyboardShortcuts={onOpenKeyboardShortcuts}
            onShowWelcomeGuide={onShowWelcomeGuide}
            onOpenFeedback={onOpenFeedback}
          />
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
            showXlLabels={showXlLabels}
            show2xlLabels={show2xlLabels}
            onToggleTheme={onToggleTheme}
            onGitHubLogin={onGitHubLogin}
            onGitHubLogout={onGitHubLogout}
            onOpenGitHubSidebar={onOpenGitHubSidebar}
            onToggleStar={onToggleStar}
          />
          <LanguageSelector outlineButtonClass={outlineButtonClass} />
        </div>
      </div>
      <MobileNavigation
        locationPath={locationPath}
        activeUmlType={activeUmlType}
        activeDiagramType={activeDiagramType}
        isDarkTheme={isDarkTheme}
        perspectives={perspectives}
        onSwitchUml={onSwitchUml}
        onSwitchDiagramType={onSwitchDiagramType}
        onNavigate={onNavigate}
      />
    </header>
  );
};

export const WorkspaceTopBar = React.memo(WorkspaceTopBarInner);
