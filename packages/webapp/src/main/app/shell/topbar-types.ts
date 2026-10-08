import type React from 'react';
import type { SupportedDiagramType } from '../../shared/types/project';
import type { GeneratorMenuMode, GeneratorType } from './workspace-types';
import type { QualityCheckResult, QualityCheckState } from '../../features/generation/types';

export interface AgentVariantOption {
  id: string;
  label: string;
  description?: string;
}

export interface WorkspaceTopBarProps {
  isDarkTheme: boolean;
  headerBackgroundClass: string;
  outlineButtonClass: string;
  primaryGenerateClass: string;
  showQualityCheck: boolean;
  generatorMode: GeneratorMenuMode;
  isGenerating: boolean;
  isAuthenticated: boolean;
  username?: string;
  githubLoading: boolean;
  hasProject: boolean;
  isDeploymentAvailable: boolean;
  /** Opens the Project Hub; an optional step targets New / Open / Import directly. */
  onOpenProjectHub: (step?: 'create' | 'open' | 'import' | 'spreadsheet' | 'github') => void;
  onOpenTemplateDialog: () => void;
  onExportProject: () => void;
  onImportSingleDiagram: () => void;
  onImportBpmnDiagram: () => void;
  onOpenAssistantImportImage: () => void;
  onOpenAssistantImportKg: () => void;
  onOpenProjectPreview: () => void;
  onGenerate: (type: GeneratorType, config?: Record<string, any>) => void;
  onQualityCheck: () => Promise<QualityCheckResult>;
  qualityCheckState?: QualityCheckState;
  showAgentVariantSelector?: boolean;
  agentVariantOptions?: AgentVariantOption[];
  activeAgentVariantId?: string;
  onAgentVariantChange?: (variantId: string) => void;
  onToggleTheme: () => void;
  onGitHubLogin: () => void;
  onGitHubLogout: () => void;
  onOpenGitHubSidebar: () => void;
  hasStarred: boolean;
  starLoading: boolean;
  onToggleStar: () => void;
  onOpenDeployDialog: () => void;
  onOpenHelpDialog: () => void;
  onOpenAboutDialog: () => void;
  onOpenFeedback: () => void;
  onOpenKeyboardShortcuts: () => void;
  onShowWelcomeGuide?: () => void;
  activeDiagramType: SupportedDiagramType;
  onSwitchDiagramType: (type: SupportedDiagramType) => void;
  onDeriveComponentDiagram?: () => void;
  onDeriveDeploymentDiagram?: () => void;
  onGenerateDockerCompose?: () => void;
  projectNameDraft: string;
  onProjectNameDraftChange: (value: string) => void;
  onProjectRename: () => void;
  /** Mobile navigation drawer (below md). */
  isMobileNavOpen: boolean;
  onOpenMobileNav: () => void;
  mobileNavTriggerRef: React.RefObject<HTMLButtonElement>;
}
