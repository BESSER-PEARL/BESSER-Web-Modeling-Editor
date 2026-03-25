import React, { useEffect, useState } from 'react';
import { Code2 } from 'lucide-react';

/* ────────────────────────────────────────────────────────────────────────────
 * GeneratingOverlay
 *
 * A modal-style overlay shown while code generation is in progress.
 * It displays animated progress steps to give the user clear feedback on
 * what is happening behind the scenes.
 * ──────────────────────────────────────────────────────────────────────────── */

const STEPS = [
  { label: 'Parsing diagram...', durationMs: 1800 },
  { label: 'Generating code...', durationMs: 3500 },
  { label: 'Packaging output...', durationMs: 2500 },
] as const;

interface GeneratingOverlayProps {
  /** Whether the overlay is visible. */
  visible: boolean;
}

/**
 * Full-screen overlay displayed during code generation.
 *
 * Shows a three-step progress indicator that advances automatically on a
 * timer. If generation completes before all steps finish, the parent simply
 * sets `visible={false}` and the overlay disappears.
 */
export const GeneratingOverlay: React.FC<GeneratingOverlayProps> = ({ visible }) => {
  const [activeStep, setActiveStep] = useState(0);

  // Reset and start the step timer whenever the overlay becomes visible.
  useEffect(() => {
    if (!visible) {
      setActiveStep(0);
      return;
    }

    let stepIndex = 0;
    setActiveStep(0);

    const advance = () => {
      stepIndex += 1;
      if (stepIndex < STEPS.length) {
        setActiveStep(stepIndex);
        timerId = window.setTimeout(advance, STEPS[stepIndex].durationMs);
      }
    };

    let timerId = window.setTimeout(advance, STEPS[0].durationMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-xl border border-slate-200/60 bg-white p-8 shadow-elevation-3 dark:border-slate-700/60 dark:bg-slate-900">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-brand/10 text-brand dark:bg-brand/20">
            <Code2 className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Generating Code
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Please wait while your code is being generated
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-brand transition-all duration-700 ease-out"
            style={{
              width: `${((activeStep + 1) / STEPS.length) * 100}%`,
            }}
          />
        </div>

        {/* Step list */}
        <ul className="flex flex-col gap-3">
          {STEPS.map((step, index) => {
            const isDone = index < activeStep;
            const isCurrent = index === activeStep;

            return (
              <li key={step.label} className="flex items-center gap-3">
                {/* Step indicator */}
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-300 ${
                    isDone
                      ? 'bg-brand text-brand-foreground'
                      : isCurrent
                        ? 'border-2 border-brand text-brand'
                        : 'border border-slate-300 text-slate-400 dark:border-slate-600 dark:text-slate-500'
                  }`}
                >
                  {isDone ? (
                    <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </span>

                {/* Label */}
                <span
                  className={`text-sm transition-colors duration-300 ${
                    isDone
                      ? 'text-slate-500 line-through dark:text-slate-400'
                      : isCurrent
                        ? 'font-medium text-slate-900 dark:text-slate-100'
                        : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {step.label}
                </span>

                {/* Animated dots for current step */}
                {isCurrent && (
                  <span className="ml-auto flex gap-0.5">
                    {[0, 1, 2].map((dotIndex) => (
                      <span
                        key={dotIndex}
                        className="inline-block size-1.5 rounded-full bg-brand"
                        style={{
                          animation: 'typing-dot-bounce 1.25s ease-out infinite',
                          animationDelay: `${dotIndex * 0.15}s`,
                        }}
                      />
                    ))}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
