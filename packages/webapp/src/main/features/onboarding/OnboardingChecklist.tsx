import React from 'react';

export interface OnboardingChecklistState {
  createdClass: boolean;
  addedAttribute: boolean;
  createdRelationship: boolean;
  generatedCode: boolean;
  exploredTemplates: boolean;
  triedQualityCheck: boolean;
}

interface OnboardingChecklistProps {
  checklist: OnboardingChecklistState;
  completed: number;
  total: number;
  allDone: boolean;
  isDarkTheme?: boolean;
  onDismiss: () => void;
}

const CHECKLIST_ITEMS: { key: keyof OnboardingChecklistState; label: string }[] = [
  { key: 'createdClass', label: 'Create a class' },
  { key: 'addedAttribute', label: 'Add an attribute' },
  { key: 'createdRelationship', label: 'Draw a relationship' },
  { key: 'generatedCode', label: 'Generate code' },
  { key: 'exploredTemplates', label: 'Explore templates' },
  { key: 'triedQualityCheck', label: 'Run a quality check' },
];

/**
 * Compact getting-started checklist, shown bottom-right while onboarding is
 * active. Onboarding is currently disabled in `application.tsx` (the
 * `useOnboarding` hook is commented out and `onboarding` is passed as null),
 * so this only renders once the feature is re-enabled. Kept minimal and
 * self-contained; wiring in `WorkspaceShell` is preserved.
 */
export function OnboardingChecklist({
  checklist,
  completed,
  total,
  allDone,
  isDarkTheme = false,
  onDismiss,
}: OnboardingChecklistProps) {
  return (
    <div
      className={`rounded-lg border p-3 shadow-lg ${
        isDarkTheme
          ? 'border-gray-700 bg-gray-800 text-gray-100'
          : 'border-gray-200 bg-white text-gray-800'
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">
          Getting started {completed}/{total}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss checklist"
          className="text-xs opacity-60 hover:opacity-100"
        >
          ✕
        </button>
      </div>
      <ul className="space-y-1">
        {CHECKLIST_ITEMS.map(({ key, label }) => (
          <li key={key} className="flex items-center gap-2 text-xs">
            <span aria-hidden>{checklist[key] ? '✅' : '⬜'}</span>
            <span className={checklist[key] ? 'line-through opacity-60' : ''}>{label}</span>
          </li>
        ))}
      </ul>
      {allDone && (
        <p className="mt-2 text-xs font-medium text-green-500">All done — nice work! 🎉</p>
      )}
    </div>
  );
}

export default OnboardingChecklist;
