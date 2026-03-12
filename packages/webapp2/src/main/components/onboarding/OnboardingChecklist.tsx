import React, { useState } from 'react';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X, Trophy } from 'lucide-react';
import type { OnboardingChecklist as ChecklistType } from './onboarding-types';
import { CHECKLIST_LABELS } from './onboarding-constants';

interface OnboardingChecklistProps {
  checklist: ChecklistType;
  completed: number;
  total: number;
  allDone: boolean;
  isDarkTheme: boolean;
  onDismiss: () => void;
}

export const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({
  checklist,
  completed,
  total,
  allDone,
  isDarkTheme,
  onDismiss,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (allDone) {
    return (
      <div className={`mx-1 mb-2 rounded-lg border p-3 text-center transition-all duration-300 ${
        isDarkTheme ? 'border-brand/30 bg-brand/10' : 'border-brand/20 bg-brand/5'
      }`}>
        <Trophy className="mx-auto mb-1 h-5 w-5 text-brand" />
        <p className="text-xs font-semibold text-brand">All done!</p>
        <p className="text-[10px] text-muted-foreground">You've completed the getting started guide.</p>
      </div>
    );
  }

  const progressPercent = (completed / total) * 100;

  return (
    <div className={`mx-1 mb-2 rounded-lg border transition-all duration-200 ${
      isDarkTheme ? 'border-slate-700/60 bg-slate-900/50' : 'border-slate-200/80 bg-white/60'
    }`}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between px-3 py-2"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Getting Started
          </span>
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
            isDarkTheme ? 'bg-brand/20 text-brand' : 'bg-brand/10 text-brand'
          }`}>
            {completed}/{total}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            className="rounded p-0.5 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
            aria-label="Dismiss checklist"
          >
            <X className="h-3 w-3" />
          </button>
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/60" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60" />
          )}
        </div>
      </button>

      {/* Progress bar */}
      <div className="mx-3 mb-1 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-brand transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Expandable items */}
      {isExpanded && (
        <div className="px-3 pb-2.5 pt-1">
          {(Object.keys(CHECKLIST_LABELS) as (keyof ChecklistType)[]).map((key) => (
            <div key={key} className="flex items-center gap-2 py-1">
              {checklist[key] ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-brand" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
              )}
              <span className={`text-[11px] ${
                checklist[key]
                  ? 'text-muted-foreground line-through'
                  : 'text-foreground'
              }`}>
                {CHECKLIST_LABELS[key]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
