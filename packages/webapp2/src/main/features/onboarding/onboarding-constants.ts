import type { TutorialStep, OnboardingChecklist } from './onboarding-types';

// localStorage keys (all prefixed with besser_)
export const ONBOARDING_KEYS = {
  completed: 'besser_onboarding_completed',
  tutorialStep: 'besser_onboarding_tutorial_step',
  tutorialDone: 'besser_onboarding_tutorial_done',
  checklist: 'besser_onboarding_checklist',
  checklistDismissed: 'besser_onboarding_checklist_dismissed',
} as const;

export const DEFAULT_CHECKLIST: OnboardingChecklist = {
  createdClass: false,
  addedAttribute: false,
  createdRelationship: false,
  generatedCode: false,
  exploredTemplates: false,
  triedQualityCheck: false,
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'create-class',
    title: 'Create a Class',
    stepLabel: 'Step 1 of 5',
    description:
      'Drag a "Class" element from the left palette onto the canvas. This is the building block of your domain model.',
    hint: 'Tip: You can also double-click on the canvas to create a class.',
  },
  {
    id: 'edit-class',
    title: 'Add Attributes & Methods',
    stepLabel: 'Step 2 of 5',
    description:
      'Double-click a class to edit it. Add an attribute like "+ name : str" or a method like "+ getName() : str".',
    hint: 'Format: [visibility] name : type\n  + public  - private  # protected\n  Types: str, int, float, bool, date',
  },
  {
    id: 'create-relationship',
    title: 'Connect Classes',
    stepLabel: 'Step 3 of 5',
    description:
      'Click a class, then drag from a blue connection point to another class. This creates an association.',
    hint: 'Multiplicity examples: 1 (exactly one), 0..* (zero or more), 1..* (one or more)',
  },
  {
    id: 'generate-code',
    title: 'Generate Code',
    stepLabel: 'Step 4 of 5',
    description:
      'Click the Generate button in the top bar and pick a target: Python, Django, FastAPI, SQL, Java, React, and 10+ more.',
    hint: 'The generated code downloads as a ZIP file ready to use.',
  },
  {
    id: 'export-save',
    title: 'Save Your Work',
    stepLabel: 'Step 5 of 5',
    description:
      'Your project auto-saves to the browser. You can also export via File menu: Export Project (JSON), Export B-UML (Python code), or Project Preview.',
    hint: 'To reopen later, click the BESSER logo or use File > Open Project Hub.',
  },
];

export const CHECKLIST_LABELS: Record<keyof OnboardingChecklist, string> = {
  createdClass: 'Create a class',
  addedAttribute: 'Add an attribute',
  createdRelationship: 'Draw a relationship',
  generatedCode: 'Generate code',
  exploredTemplates: 'Explore templates',
  triedQualityCheck: 'Run quality check',
};
