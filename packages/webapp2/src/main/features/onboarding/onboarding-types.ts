export interface TutorialStep {
  id: string;
  title: string;
  stepLabel: string;
  description: string;
  hint?: string;
}

export interface OnboardingChecklist {
  createdClass: boolean;
  addedAttribute: boolean;
  createdRelationship: boolean;
  generatedCode: boolean;
  exploredTemplates: boolean;
  triedQualityCheck: boolean;
}

export interface OnboardingState {
  hasCompletedWelcome: boolean;
  tutorialStep: number;
  isTutorialActive: boolean;
  isTutorialDone: boolean;
  checklist: OnboardingChecklist;
  checklistDismissed: boolean;
}
