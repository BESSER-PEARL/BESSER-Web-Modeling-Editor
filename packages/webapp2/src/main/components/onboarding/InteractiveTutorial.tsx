import React from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, X, Lightbulb } from 'lucide-react';
import { TUTORIAL_STEPS } from './onboarding-constants';

interface InteractiveTutorialProps {
  visible: boolean;
  currentStep: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onFinish: () => void;
}

export const InteractiveTutorial: React.FC<InteractiveTutorialProps> = ({
  visible,
  currentStep,
  onNext,
  onBack,
  onSkip,
  onFinish,
}) => {
  if (!visible) return null;

  const step = TUTORIAL_STEPS[currentStep];
  if (!step) return null;

  const isLast = currentStep === TUTORIAL_STEPS.length - 1;
  const isFirst = currentStep === 0;
  const progress = ((currentStep + 1) / TUTORIAL_STEPS.length) * 100;

  return createPortal(
    <div className="fixed bottom-6 right-6 z-[9999] w-[360px] rounded-xl border border-border/60 bg-background p-5 shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-200">
      {/* Progress bar */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {step.stepLabel}
        </span>
        <button
          type="button"
          onClick={onSkip}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Skip tutorial"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress track */}
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-brand transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Content */}
      <h3 className="mb-2 text-base font-semibold">{step.title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {step.description}
      </p>

      {step.hint && (
        <div className="mt-3 flex gap-2 rounded-lg bg-brand/5 p-3 text-xs text-muted-foreground">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
          <span className="whitespace-pre-line">{step.hint}</span>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={isFirst}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={isLast ? onFinish : onNext}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground transition-colors hover:bg-brand-dark"
          >
            {isLast ? 'Finish' : 'Next'}
            {!isLast && <ArrowRight className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
