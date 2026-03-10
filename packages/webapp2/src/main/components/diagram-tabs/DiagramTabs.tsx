import React, { useCallback, useEffect, useState } from 'react';
import { diagramBridge } from '@besser/wme';
import { Plus, X, FileText } from 'lucide-react';
import { toast } from 'react-toastify';
import { Input } from '@/components/ui/input';
import { ProjectDiagram, MAX_DIAGRAMS_PER_TYPE, SupportedDiagramType, isUMLModel } from '../../types/project';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  addDiagramThunk,
  removeDiagramThunk,
  renameDiagramThunk,
  switchDiagramIndexThunk,
  selectCurrentDiagramIndex,
  selectDiagramsForCurrentType,
  selectCurrentDiagramType,
  selectCurrentProject,
} from '../../services/project/projectSlice';
import { setCreateNewEditor } from '../../services/diagram/diagramSlice';
import { ProjectStorageRepository } from '../../services/storage/ProjectStorageRepository';

export const DiagramTabs: React.FC = () => {
  const dispatch = useAppDispatch();
  const diagrams = useAppSelector(selectDiagramsForCurrentType);
  const currentIndex = useAppSelector(selectCurrentDiagramIndex);
  const currentDiagramType = useAppSelector(selectCurrentDiagramType);
  const currentProject = useAppSelector(selectCurrentProject);
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // --- Class Diagram reference for Object Diagrams and GUI Diagrams ---
  const needsClassRef = currentDiagramType === 'ObjectDiagram' || currentDiagramType === 'GUINoCodeDiagram';
  const classDiagrams = currentProject?.diagrams?.ClassDiagram ?? [];
  const [classRefIndex, setClassRefIndex] = useState<number>(
    () => currentProject?.currentDiagramIndices?.ClassDiagram ?? 0,
  );

  // Sync the bridge/storage when the reference changes.
  // Track the last applied index so we only recreate the editor when
  // the user explicitly picks a different class reference — not on
  // every unrelated project update that gives currentProject a new ref.
  const prevClassRefIndexRef = React.useRef<number | null>(null);
  useEffect(() => {
    if (!needsClassRef || classDiagrams.length === 0) return;
    const safeIndex = Math.min(classRefIndex, classDiagrams.length - 1);
    const refModel = classDiagrams[safeIndex]?.model;

    if (currentDiagramType === 'ObjectDiagram') {
      // Object Diagram: always keep bridge data fresh
      if (isUMLModel(refModel)) {
        diagramBridge.setClassDiagramData(refModel);
        // Only recreate editor when the reference actually changed
        const indexChanged =
          prevClassRefIndexRef.current !== null &&
          prevClassRefIndexRef.current !== safeIndex;
        prevClassRefIndexRef.current = safeIndex;
        if (indexChanged) {
          dispatch(setCreateNewEditor(true));
        }
      }
    } else if (currentDiagramType === 'GUINoCodeDiagram') {
      // GUI Diagram: update the Class Diagram active index in storage
      // so diagram-helpers reads the correct class diagram for auto-generate
      if (currentProject) {
        ProjectStorageRepository.switchDiagramIndex(currentProject.id, 'ClassDiagram', safeIndex);
      }
    }
  }, [needsClassRef, currentDiagramType, classRefIndex, classDiagrams, currentProject, dispatch]);

  const handleClassRefChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setClassRefIndex(Number(e.target.value));
  }, []);

  const showTabs = diagrams.length > 0;

  const handleSwitchTab = useCallback(
    (index: number) => {
      if (index !== currentIndex) {
        dispatch(switchDiagramIndexThunk({ diagramType: currentDiagramType, index }));
      }
    },
    [dispatch, currentDiagramType, currentIndex],
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

  return (
    <div className="flex items-center gap-0 border-b border-slate-300/50 bg-gradient-to-r from-slate-50/80 to-white/60 px-1 backdrop-blur-sm dark:border-slate-700/50 dark:from-slate-900/80 dark:to-slate-800/60">
      {/* Diagram tabs */}
      <div className="flex items-end gap-px py-1 pl-1">
        {diagrams.map((diagram: ProjectDiagram, index: number) => {
          const isActive = index === currentIndex;
          const isRenaming = renamingIndex === index;

          return (
            <div
              key={diagram.id}
              className={[
                'group relative flex cursor-pointer select-none items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-all duration-150',
                isActive
                  ? 'bg-white text-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.05)] dark:bg-slate-800 dark:text-slate-100 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.06)]'
                  : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200',
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
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <FileText className={`h-3 w-3 shrink-0 ${isActive ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400 dark:text-slate-500'}`} />
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
            className="ml-0.5 flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100/80 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800/50 dark:hover:text-slate-300"
            onClick={handleAddDiagram}
            title="Add new diagram"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Class Diagram reference selector (Object Diagram / GUI Diagram) */}
      {needsClassRef && classDiagrams.length > 0 && (
        <div className="ml-auto flex items-center gap-2 pr-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Reference
          </span>
          <select
            className="h-6 rounded-md border border-slate-200/80 bg-white/90 px-2 text-[11px] font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-300 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-300 dark:hover:border-slate-600 dark:focus:border-slate-500 dark:focus:ring-slate-600"
            value={classRefIndex}
            onChange={handleClassRefChange}
          >
            {classDiagrams.map((cd, idx) => (
              <option key={cd.id} value={idx}>
                {cd.title}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};
