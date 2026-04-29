import { UMLDiagramType } from '@besser/wme';
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
  locationPath: string;
  activeUmlType: UMLDiagramType;
  isAuthenticated: boolean;
  username?: string;
  githubLoading: boolean;
  hasProject: boolean;
  isDeploymentAvailable: boolean;
  onOpenProjectHub: () => void;
  onOpenTemplateDialog: () => void;
  onExportProject: () => void;
  onImportSingleDiagram: () => void;
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
  onSwitchUml: (type: UMLDiagramType) => void;
  onSwitchDiagramType: (type: SupportedDiagramType) => void;
  onNavigate: (path: string) => void;
  projectNameDraft: string;
  onProjectNameDraftChange: (value: string) => void;
  onProjectRename: () => void;
}
