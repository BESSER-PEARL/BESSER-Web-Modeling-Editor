import { useCallback, useEffect, useState } from 'react';
import type { OnboardingChecklist, OnboardingState } from './onboarding-types';
import { DEFAULT_CHECKLIST, ONBOARDING_KEYS, TUTORIAL_STEPS } from './onboarding-constants';

function loadChecklist(): OnboardingChecklist {
  try {
    const raw = localStorage.getItem(ONBOARDING_KEYS.checklist);
    if (raw) return { ...DEFAULT_CHECKLIST, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return { ...DEFAULT_CHECKLIST };
}

function saveChecklist(checklist: OnboardingChecklist) {
  localStorage.setItem(ONBOARDING_KEYS.checklist, JSON.stringify(checklist));
}

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>(() => ({
    hasCompletedWelcome: localStorage.getItem(ONBOARDING_KEYS.completed) === 'true',
    tutorialStep: Number(localStorage.getItem(ONBOARDING_KEYS.tutorialStep) || '0'),
    isTutorialActive: false,
    isTutorialDone: localStorage.getItem(ONBOARDING_KEYS.tutorialDone) === 'true',
    checklist: loadChecklist(),
    checklistDismissed: localStorage.getItem(ONBOARDING_KEYS.checklistDismissed) === 'true',
  }));

  // Start the tutorial directly (from menu)
  const startTutorial = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEYS.completed, 'true');
    localStorage.removeItem(ONBOARDING_KEYS.tutorialStep);
    localStorage.removeItem(ONBOARDING_KEYS.tutorialDone);
    setState((prev) => ({
      ...prev,
      hasCompletedWelcome: true,
      tutorialStep: 0,
      isTutorialActive: true,
      isTutorialDone: false,
    }));
  }, []);

  // Tutorial navigation
  const advanceTutorial = useCallback(() => {
    setState((prev) => {
      const nextStep = prev.tutorialStep + 1;
      if (nextStep >= TUTORIAL_STEPS.length) {
        localStorage.setItem(ONBOARDING_KEYS.tutorialDone, 'true');
        localStorage.removeItem(ONBOARDING_KEYS.tutorialStep);
        return { ...prev, tutorialStep: 0, isTutorialActive: false, isTutorialDone: true };
      }
      localStorage.setItem(ONBOARDING_KEYS.tutorialStep, String(nextStep));
      return { ...prev, tutorialStep: nextStep };
    });
  }, []);

  const goBackTutorial = useCallback(() => {
    setState((prev) => {
      const prevStep = Math.max(0, prev.tutorialStep - 1);
      localStorage.setItem(ONBOARDING_KEYS.tutorialStep, String(prevStep));
      return { ...prev, tutorialStep: prevStep };
    });
  }, []);

  const skipTutorial = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEYS.tutorialDone, 'true');
    localStorage.removeItem(ONBOARDING_KEYS.tutorialStep);
    setState((prev) => ({
      ...prev,
      tutorialStep: 0,
      isTutorialActive: false,
      isTutorialDone: true,
    }));
  }, []);

  const finishTutorial = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEYS.tutorialDone, 'true');
    localStorage.removeItem(ONBOARDING_KEYS.tutorialStep);
    setState((prev) => ({
      ...prev,
      tutorialStep: 0,
      isTutorialActive: false,
      isTutorialDone: true,
    }));
  }, []);

  // Checklist updates
  const updateChecklist = useCallback((key: keyof OnboardingChecklist) => {
    setState((prev) => {
      if (prev.checklist[key]) return prev; // already true
      const updated = { ...prev.checklist, [key]: true };
      saveChecklist(updated);
      return { ...prev, checklist: updated };
    });
  }, []);

  const dismissChecklist = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEYS.checklistDismissed, 'true');
    setState((prev) => ({ ...prev, checklistDismissed: true }));
  }, []);

  // Checklist completion count
  const checklistCompleted = Object.values(state.checklist).filter(Boolean).length;
  const checklistTotal = Object.keys(state.checklist).length;
  const allChecklistDone = checklistCompleted === checklistTotal;

  // Auto-dismiss checklist when all done (after a short delay)
  useEffect(() => {
    if (allChecklistDone && !state.checklistDismissed) {
      const timer = setTimeout(() => {
        dismissChecklist();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [allChecklistDone, state.checklistDismissed, dismissChecklist]);

  return {
    // State
    isTutorialActive: state.isTutorialActive,
    isTutorialDone: state.isTutorialDone,
    tutorialStep: state.tutorialStep,
    currentStepData: TUTORIAL_STEPS[state.tutorialStep],
    totalSteps: TUTORIAL_STEPS.length,
    checklist: state.checklist,
    checklistDismissed: state.checklistDismissed,
    checklistCompleted,
    checklistTotal,
    allChecklistDone,

    // Actions
    startTutorial,
    advanceTutorial,
    goBackTutorial,
    skipTutorial,
    finishTutorial,
    updateChecklist,
    dismissChecklist,
  };
}
