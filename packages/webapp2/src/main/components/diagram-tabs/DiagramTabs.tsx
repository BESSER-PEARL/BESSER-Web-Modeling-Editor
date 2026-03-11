import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { diagramBridge } from '@besser/wme';
import { Plus, X, FileText, Info, Link2, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'react-toastify';
import { Input } from '@/components/ui/input';
import { ProjectDiagram, MAX_DIAGRAMS_PER_TYPE, SupportedDiagramType, isUMLModel, isGrapesJSProjectData, isQuantumCircuitData } from '../../types/project';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  addDiagramThunk,
  removeDiagramThunk,
  renameDiagramThunk,
  switchDiagramIndexThunk,
  updateDiagramReferencesThunk,
  bumpEditorRevision,
  selectActiveDiagramIndex,
  selectDiagramsForActiveType,
  selectActiveDiagramType,
  selectProject,
} from '../../services/workspace/workspaceSlice';

/* ------------------------------------------------------------------ */
/*  Small inline tooltip used for info icons next to reference labels  */
/* ------------------------------------------------------------------ */
const InfoTooltip: React.FC<{ text: string }> = ({ text }) => {
  const [visible, setVisible] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  return (
    <span
      ref={wrapperRef}
      className="relative inline-flex cursor-help"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      tabIndex={0}
      role="note"
      aria-label={text}
    >
      <Info className="h-3 w-3 text-slate-400 dark:text-slate-500" />
      {visible && (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-56 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] leading-snug text-slate-600 shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          {text}
        </span>
      )}
    </span>
  );
};

/* ------------------------------------------------------------------ */
/*  Helper: detect whether a diagram's model is essentially empty      */
/* ------------------------------------------------------------------ */
const isDiagramEmpty = (diagram: ProjectDiagram | undefined): boolean => {
  if (!diagram?.model) return true;
  if (isUMLModel(diagram.model)) {
    const elCount = Object.keys(diagram.model.elements ?? {}).length;
    const relCount = Object.keys(diagram.model.relationships ?? {}).length;
    return elCount === 0 && relCount === 0;
  }
  if (isGrapesJSProjectData(diagram.model)) {
    const pages = diagram.model.pages ?? [];
    if (pages.length === 0) return true;
    // A default empty GUI diagram has one page with a wrapper whose components array is empty.
    // Check whether any page has meaningful (non-empty) content inside its frames.
    const hasContent = pages.some((page: any) => {
      const frames: any[] = Array.isArray(page.frames) ? page.frames : [];
      return frames.some((frame: any) => {
        const comps: any[] = frame?.component?.components ?? [];
        return comps.length > 0;
      });
    });
    return !hasContent;
  }
  if (isQuantumCircuitData(diagram.model)) {
    const cols = diagram.model.cols ?? [];
    return cols.length === 0;
  }
  return false;
};

export const DiagramTabs: React.FC = () => {
  const dispatch = useAppDispatch();
  const diagrams = useAppSelector(selectDiagramsForActiveType);
  const currentIndex = useAppSelector(selectActiveDiagramIndex);
  const currentDiagramType = useAppSelector(selectActiveDiagramType);
  const currentProject = useAppSelector(selectProject);
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // --- Cross-diagram references ---
  const needsClassRef = currentDiagramType === 'ObjectDiagram' || currentDiagramType === 'GUINoCodeDiagram';
  // Agent diagrams are referenced per-component inside the GUI editor (drag & drop),
  // not as a single diagram-level reference, so no dropdown is needed here.

  const classDiagrams = useMemo(
    () => currentProject?.diagrams?.ClassDiagram ?? [],
    [currentProject?.diagrams?.ClassDiagram],
  );

  // Read the active diagram's persisted references (ID-based)
  // Clamp the index to prevent out-of-bounds access when diagrams array
  // shrinks (e.g. after deletion) before Redux state catches up.
  const safeIndex = diagrams.length > 0 ? Math.min(currentIndex, diagrams.length - 1) : 0;
  const activeDiagram = diagrams[safeIndex];
  const [classRefId, setClassRefId] = useState<string>(
    () => activeDiagram?.references?.ClassDiagram ?? classDiagrams[0]?.id ?? '',
  );

  // When the active diagram tab changes or its references update, restore persisted references
  useEffect(() => {
    setClassRefId(activeDiagram?.references?.ClassDiagram ?? classDiagrams[0]?.id ?? '');
  }, [activeDiagram?.id, activeDiagram?.references?.ClassDiagram, classDiagrams]);

  // Sync the bridge when ClassDiagram reference changes (ObjectDiagram needs it)
  const prevClassRefIdRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!needsClassRef || classDiagrams.length === 0 || !classRefId) return;
    const refDiagram = classDiagrams.find(d => d.id === classRefId);
    const refModel = refDiagram?.model;

    if (currentDiagramType === 'ObjectDiagram') {
      if (isUMLModel(refModel)) {
        diagramBridge.setClassDiagramData(refModel);
        const idChanged =
          prevClassRefIdRef.current !== null &&
          prevClassRefIdRef.current !== classRefId;
        prevClassRefIdRef.current = classRefId;
        if (idChanged) {
          dispatch(bumpEditorRevision());
        }
      }
    }
    // For GUI: no bridge side-effect needed — diagram-helpers reads per-diagram references
  }, [needsClassRef, currentDiagramType, classRefId, classDiagrams, dispatch]);

  const handleClassRefChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setClassRefId(newId);
    dispatch(updateDiagramReferencesThunk({
      diagramType: currentDiagramType,
      diagramIndex: safeIndex,
      references: { ClassDiagram: newId },
    }));
  }, [dispatch, currentDiagramType, safeIndex]);

  const showTabs = diagrams.length > 0;
  const [refsCollapsed, setRefsCollapsed] = useState(false);

  // --- Reference status helpers ---
  const classRefDiagram = useMemo(
    () => classDiagrams.find((d) => d.id === classRefId),
    [classDiagrams, classRefId],
  );

  const classRefBroken = needsClassRef && classRefId !== '' && !classRefDiagram;
  const classRefEmpty = needsClassRef && !!classRefDiagram && isDiagramEmpty(classRefDiagram);

  // Tooltip descriptions per diagram type
  const classRefTooltip =
    currentDiagramType === 'ObjectDiagram'
      ? 'Select which Class Diagram provides the data model for this Object Diagram'
      : 'Select which Class Diagram provides the data model for this GUI';

  const handleSwitchTab = useCallback(
    (index: number) => {
      if (index !== safeIndex) {
        dispatch(switchDiagramIndexThunk({ diagramType: currentDiagramType, index }));
      }
    },
    [dispatch, currentDiagramType, safeIndex],
  );

  const handleAddDiagram = useCallback(() => {
    if (diagrams.length >= MAX_DIAGRAMS_PER_TYPE) {
      toast.warning(`Maximum ${MAX_DIAGRAMS_PER_TYPE} diagrams per type.`);
      return;
    }
    dispatch(addDiagramThunk({ diagramType: currentDiagramType }));
  }, [dispatch, currentDiagramType, diagrams.length]);

  const handleRemoveDiagram = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.stopPropagation();
      if (diagrams.length <= 1) {
        return;
      }
      dispatch(removeDiagramThunk({ diagramType: currentDiagramType, index }));
    },
    [dispatch, currentDiagramType, diagrams.length],
  );

  const handleStartRename = useCallback(
    (index: number) => {
      setRenamingIndex(index);
      setRenameValue(diagrams[index]?.title ?? '');
    },
    [diagrams],
  );

  const handleFinishRename = useCallback(() => {
    if (renamingIndex === null) return;
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== diagrams[renamingIndex]?.title) {
      dispatch(renameDiagramThunk({ diagramType: currentDiagramType, index: renamingIndex, newTitle: trimmed }));
    }
    setRenamingIndex(null);
  }, [dispatch, currentDiagramType, renamingIndex, renameValue, diagrams]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleFinishRename();
      if (e.key === 'Escape') setRenamingIndex(null);
    },
    [handleFinishRename],
  );

  if (!showTabs) return null;

  const hasReferences = needsClassRef;

  const selectClasses = "h-6 min-w-[120px] rounded-md border border-[#397C95]/15 bg-white/90 px-2 text-[11px] font-medium text-slate-600 shadow-sm transition-colors hover:border-[#397C95]/30 focus:border-[#397C95]/40 focus:outline-none focus:ring-1 focus:ring-[#397C95]/20 dark:border-[#397C95]/20 dark:bg-slate-800/90 dark:text-slate-300 dark:hover:border-[#5BB8D4]/30 dark:focus:border-[#5BB8D4]/40 dark:focus:ring-[#5BB8D4]/20";

  return (
    <div className="border-b border-[#397C95]/12 bg-gradient-to-r from-slate-50/80 to-white/60 backdrop-blur-sm dark:border-[#397C95]/15 dark:from-slate-900/80 dark:to-slate-800/60">
      {/* Top row: tabs */}
      <div className="flex items-center gap-0 px-1">
        <div className="flex items-end gap-px py-1 pl-1">
          {diagrams.map((diagram: ProjectDiagram, index: number) => {
            const isActive = index === safeIndex;
            const isRenaming = renamingIndex === index;

            return (
              <div
                key={diagram.id}
                role="tab"
                aria-selected={isActive}
                aria-label={`Diagram tab: ${diagram.title}`}
                className={[
                  'group relative flex cursor-pointer select-none items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-all duration-150',
                  isActive
                    ? 'border-b-2 border-[#397C95] bg-white text-[#2C6A82] shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_0_1px_rgba(57,124,149,0.1)] dark:border-[#5BB8D4] dark:bg-slate-800 dark:text-[#5BB8D4] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),0_0_0_1px_rgba(91,184,212,0.12)]'
                    : 'text-slate-500 hover:bg-[#397C95]/[0.04] hover:text-slate-700 dark:text-slate-400 dark:hover:bg-[#397C95]/[0.06] dark:hover:text-slate-200',
                ].join(' ')}
                onClick={() => handleSwitchTab(index)}
                onDoubleClick={() => handleStartRename(index)}
              >
                {isRenaming ? (
                  <Input
                    className="h-5 w-24 rounded-sm border-slate-300 bg-white px-1.5 py-0 text-[11px] shadow-inner focus-visible:ring-1 focus-visible:ring-slate-400 dark:border-slate-600 dark:bg-slate-900"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={handleFinishRename}
                    onKeyDown={handleRenameKeyDown}
                    autoFocus
                    aria-label="Rename diagram"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <FileText className={`h-3 w-3 shrink-0 ${isActive ? 'text-[#397C95] dark:text-[#5BB8D4]' : 'text-slate-400 dark:text-slate-500'}`} />
                    <span className="max-w-[140px] truncate">{diagram.title}</span>
                  </>
                )}

                {diagrams.length > 1 && !isRenaming && (
                  <button
                    className={[
                      'ml-0.5 rounded-sm p-0.5 transition-colors',
                      isActive
                        ? 'text-slate-400 hover:bg-slate-200 hover:text-red-500 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-red-400'
                        : 'invisible text-slate-400 hover:bg-slate-200 hover:text-red-500 group-hover:visible dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-red-400',
                    ].join(' ')}
                    onClick={(e) => handleRemoveDiagram(e, index)}
                    aria-label={`Close diagram ${diagram.title}`}
                    title="Close diagram"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Add button */}
          {diagrams.length < MAX_DIAGRAMS_PER_TYPE && (
            <button
              className="ml-0.5 flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-[#397C95]/[0.06] hover:text-[#397C95] dark:text-slate-500 dark:hover:bg-[#397C95]/10 dark:hover:text-[#5BB8D4]"
              onClick={handleAddDiagram}
              aria-label="Add new diagram"
              title="Add new diagram"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Collapse toggle for references (inline in tab bar, right-aligned) */}
        {hasReferences && (
          <button
            className="ml-auto mr-1 flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:bg-slate-100/80 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800/50 dark:hover:text-slate-300"
            onClick={() => setRefsCollapsed((prev) => !prev)}
            aria-label={refsCollapsed ? 'Expand linked diagrams' : 'Collapse linked diagrams'}
            aria-expanded={!refsCollapsed}
            title={refsCollapsed ? 'Show linked diagrams' : 'Hide linked diagrams'}
          >
            <Link2 className="h-3 w-3" />
            <span className="hidden sm:inline">Linked Diagrams</span>
            {refsCollapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        )}
      </div>

      {/* Linked Diagrams reference section (below tabs) */}
      {hasReferences && !refsCollapsed && (
        <div className="border-t border-slate-200/60 bg-slate-50/50 px-3 py-1.5 dark:border-slate-700/40 dark:bg-slate-900/40">
          <div className="flex flex-wrap items-center gap-4">
            {/* Section header */}
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              <Link2 className="h-3 w-3" />
              References
            </span>

            {/* ClassDiagram reference */}
            {needsClassRef && (
              <div className="flex items-center gap-1.5">
                <label
                  htmlFor="ref-class-diagram"
                  className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  Class Diagram
                </label>
                <InfoTooltip text={classRefTooltip} />

                {classDiagrams.length > 0 ? (
                  <>
                    <select
                      id="ref-class-diagram"
                      className={selectClasses}
                      value={classRefBroken ? '' : classRefId}
                      onChange={handleClassRefChange}
                      aria-label={classRefTooltip}
                    >
                      {classRefBroken && (
                        <option value="" disabled>
                          Reference broken - please reselect
                        </option>
                      )}
                      {classDiagrams.map((cd) => (
                        <option key={cd.id} value={cd.id}>
                          {cd.title}
                        </option>
                      ))}
                    </select>
                    {classRefBroken && (
                      <span title="The referenced diagram was deleted. Please select a new one.">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                      </span>
                    )}
                    {!classRefBroken && classRefEmpty && (
                      <span title="The referenced Class Diagram is empty (no classes or relationships).">
                        <AlertTriangle className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                      </span>
                    )}
                  </>
                ) : (
                  <span className="rounded-md border border-dashed border-slate-300 bg-white/60 px-2 py-0.5 text-[11px] italic text-slate-400 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-500">
                    No Class Diagrams available
                  </span>
                )}
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
};
