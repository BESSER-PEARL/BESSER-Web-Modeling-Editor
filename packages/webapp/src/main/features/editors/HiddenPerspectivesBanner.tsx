import React, { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { findHiddenReferencedPerspectives, SupportedDiagramType } from '../../shared/types/project';
import { PERSPECTIVE_LABELS } from '../../shared/constants/diagramTypeStyles';
import { useAppDispatch, useAppSelector } from '../../app/store/hooks';
import { selectProject, setPerspectiveEnabledThunk } from '../../app/store/workspaceSlice';

/**
 * Non-blocking banner that surfaces when the active project contains content
 * (or cross-diagram references) pointing at a perspective the user has hidden
 * in Project Settings. Each affected perspective gets an inline "Enable" button.
 *
 * Renders nothing when no hidden-but-referenced perspective is detected.
 */
export const HiddenPerspectivesBanner: React.FC = () => {
  const project = useAppSelector(selectProject);
  const dispatch = useAppDispatch();

  const hidden = useMemo(
    () => (project ? findHiddenReferencedPerspectives(project) : []),
    [project],
  );

  if (hidden.length === 0) return null;

  const handleEnable = (type: SupportedDiagramType) => {
    void dispatch(setPerspectiveEnabledThunk({ type, enabled: true }));
  };

  const labelList = hidden.map((t) => PERSPECTIVE_LABELS[t]).join(', ');

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="hidden-perspectives-banner"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200"
    >
      <span className="flex items-center gap-2">
        <AlertTriangle className="size-4 shrink-0" />
        <span>
          This project uses <span className="font-medium">{labelList}</span> but{' '}
          {hidden.length === 1 ? 'that perspective is' : 'those perspectives are'} hidden.
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-2">
        {hidden.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => handleEnable(type)}
            data-testid={`enable-perspective-${type}`}
            className="inline-flex items-center rounded-md border border-amber-400 bg-white px-2 py-1 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/40"
          >
            Enable {PERSPECTIVE_LABELS[type]}
          </button>
        ))}
      </span>
    </div>
  );
};
