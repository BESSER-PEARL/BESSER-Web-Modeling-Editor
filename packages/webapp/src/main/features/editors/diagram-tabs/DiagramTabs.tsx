import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { diagramBridge } from '@besser/wme';
import { Plus, X, FileText, Info, Link2, AlertTriangle, ChevronDown, ChevronRight, Wand2, ClipboardList } from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { getPostHog } from '../../../shared/services/analytics/lazy-analytics';
import { apiClient } from '../../../shared/api/api-client';
import { ProjectDiagram, MAX_DIAGRAMS_PER_TYPE, SupportedDiagramType, isUMLModel, isGrapesJSProjectData, isQuantumCircuitData } from '../../../shared/types/project';
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks';
import type { QualityCheckState } from '../../generation/types';
import {
  addDiagramThunk,
  removeDiagramThunk,
  renameDiagramThunk,
  switchDiagramIndexThunk,
  updateDiagramModelThunk,
  updateDiagramReferencesThunk,
  bumpEditorRevision,
  selectActiveDiagramIndex,
  selectDiagramsForActiveType,
  selectActiveDiagramType,
  selectProject,
} from '../../../app/store/workspaceSlice';
import { ApollonEditorContext } from '../uml/apollon-editor-context';
import { scaffoldObjectsFromClasses } from './scaffoldObjectsFromClasses';
import { UserProfileFormPanel } from '../user-profile-form/UserProfileFormPanel';

interface DiagramTabsProps {
  onRequestTabSwitch?: (index: number) => Promise<boolean> | boolean;
  userModelValidationStatusById?: Record<string, QualityCheckState>;
}

/* ------------------------------------------------------------------ */
/*  Small inline tooltip used for info icons next to reference labels  */
/*  Renders via portal to avoid being clipped by editor stacking ctx  */
/* ------------------------------------------------------------------ */
const InfoTooltip: React.FC<{ text: string }> = ({ text }) => {
  const [visible, setVisible] = useState(false);
  const iconRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (visible && iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 6,
        left: rect.left + rect.width / 2,
      });
    }
  }, [visible]);

  return (
    <span
      ref={iconRef}
      className="relative inline-flex cursor-help"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      tabIndex={0}
      role="note"
      aria-label={text}
    >
      <Info className="size-3 text-muted-foreground" />
      {visible && ReactDOM.createPortal(
        <span
          role="tooltip"
          className="pointer-events-none fixed z-[9999] w-56 -translate-x-1/2 rounded-md border border-border bg-popover px-2.5 py-1.5 text-[11px] leading-snug text-popover-foreground shadow-lg"
          style={{ top: pos.top, left: pos.left }}
        >
          {text}
        </span>,
        document.body,
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

export const DiagramTabs: React.FC<DiagramTabsProps> = ({
  onRequestTabSwitch,
  userModelValidationStatusById,
}) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const diagrams = useAppSelector(selectDiagramsForActiveType);
  const currentIndex = useAppSelector(selectActiveDiagramIndex);
  const currentDiagramType = useAppSelector(selectActiveDiagramType);
  const currentProject = useAppSelector(selectProject);
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [profileFormOpen, setProfileFormOpen] = useState(false);

  const isUserDiagram = currentDiagramType === 'UserDiagram';

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
        if (prevClassRefIdRef.current !== null && prevClassRefIdRef.current !== classRefId) {
          dispatch(bumpEditorRevision());
        }
        prevClassRefIdRef.current = classRefId;
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

  const { editor: apollonEditor } = useContext(ApollonEditorContext);

  const handleGenerateObjectsFromClasses = useCallback(async () => {
    if (currentDiagramType !== 'ObjectDiagram') return;
    if (!apollonEditor || !apollonEditor.model) {
      toast.error(t('editors.diagramTabs.editorNotReady'));
      return;
    }
    const refDiagram = classDiagrams.find((d) => d.id === classRefId);
    const refModel = refDiagram?.model;
    if (!isUMLModel(refModel)) {
      toast.error(t('editors.diagramTabs.pickClassRefFirst'));
      return;
    }
    const classCount = Object.values(refModel.elements ?? {}).filter(
      (el: any) => el?.type === 'Class',
    ).length;
    if (classCount === 0) {
      toast.warning(t('editors.diagramTabs.noClassesToInstantiate'));
      return;
    }

    const { model: nextModel, created, skipped, links } = scaffoldObjectsFromClasses({
      classModel: refModel,
      objectModel: apollonEditor.model,
    });

    // Push to redux first so a refresh / undo stack snapshot reflects the
    // generated objects, then propagate to the Apollon editor canvas.
    await dispatch(updateDiagramModelThunk({ model: nextModel as any })).unwrap();
    await apollonEditor.nextRender;
    apollonEditor.model = { ...nextModel } as any;
    await apollonEditor.nextRender;

    const linksFragment = links > 0 ? t('editors.diagramTabs.linksFragment', { count: links }) : '';
    if (created === 0 && links === 0 && skipped > 0) {
      toast.info(t('editors.diagramTabs.allClassesHaveInstance', { count: skipped }));
    } else if (skipped > 0) {
      toast.success(t('editors.diagramTabs.generatedWithSkipped', { count: created, links: linksFragment, skipped }));
    } else {
      toast.success(t('editors.diagramTabs.generatedFromClassDiagram', { count: created, links: linksFragment }));
    }
    getPostHog()?.capture('object_diagram_generated_from_class', { created, skipped, links });
  }, [apollonEditor, classDiagrams, classRefId, currentDiagramType, dispatch]);

  const handleGenerateSat = useCallback(async () => {
    if (currentDiagramType !== 'ObjectDiagram') return;
    if (!apollonEditor || !apollonEditor.model) {
      toast.error(t('editors.diagramTabs.editorNotReady'));
      return;
    }

    const refDiagram = classDiagrams.find((d) => d.id === classRefId);
    const refModel = refDiagram?.model;
    if (!isUMLModel(refModel)) {
      toast.error(t('editors.diagramTabs.pickClassRefFirst'));
      return;
    }

    const toastId = toast.loading(`🔍 ${t('editors.diagramTabs.starting')}`);

    try {
      const finalResult = await apiClient.postSSE<{
        done?: boolean;
        sat?: boolean;
        message?: string;
        error?: string;
        object_model?: unknown;
      }>(
        '/generate-object-diagram',
        {
          title: refDiagram?.title ?? 'Class Diagram',
          model: refModel,
        },
        (event) => {
          if (event?.message && !event.done) {
            toast.update(toastId, { render: event.message });
          }
        },
      );

      if (!finalResult) {
        throw new Error(t('editors.diagramTabs.noResult'));
      }

      if (finalResult.sat !== true) {
        toast.update(toastId, {
          render: `❌ ${finalResult?.message ?? t('editors.diagramTabs.unsatisfiable')}`,
          type: 'warning',
          isLoading: false,
          autoClose: 5000,
        });
        return;
      }

      const nextModel = finalResult?.object_model;
      if (!isUMLModel(nextModel)) {
        const details = typeof finalResult?.error === 'string' ? ` ${finalResult.error}` : '';
        toast.update(toastId, {
          render: `⚠️ ${t('editors.diagramTabs.payloadMissing')}.${details}`,
          type: 'warning',
          isLoading: false,
          autoClose: 5000,
        });
        return;
      }

      await dispatch(updateDiagramModelThunk({ model: nextModel as any })).unwrap();
      await apollonEditor.nextRender;
      apollonEditor.model = { ...nextModel } as any;
      await apollonEditor.nextRender;

      toast.update(toastId, {
        render: `✅ ${finalResult?.message ?? t('editors.diagramTabs.success')}`,
        type: 'success',
        isLoading: false,
        autoClose: 5000,
      });
      getPostHog()?.capture('object_diagram_generated_from_sat', {
        elements: Object.keys(nextModel.elements ?? {}).length,
        relationships: Object.keys(nextModel.relationships ?? {}).length,
      });
    } catch (error) {
      toast.dismiss(toastId);
      const details = error instanceof Error ? error.message : String(error);
      toast.error(`${t('editors.diagramTabs.failed')}: ${details}`);
    }
  }, [apollonEditor, classDiagrams, classRefId, currentDiagramType, dispatch, t]);

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
      ? t('editors.diagramTabs.classRefTooltipObject')
      : t('editors.diagramTabs.classRefTooltipGui');

  const handleSwitchTab = useCallback(
    async (index: number) => {
      if (index === safeIndex) {
        return;
      }

      if (onRequestTabSwitch) {
        const canSwitch = await onRequestTabSwitch(index);
        if (!canSwitch) {
          return;
        }
      }

      dispatch(switchDiagramIndexThunk({ diagramType: currentDiagramType, index }));
    },
    [dispatch, currentDiagramType, safeIndex, onRequestTabSwitch],
  );

  const handleAddDiagram = useCallback(() => {
    if (diagrams.length >= MAX_DIAGRAMS_PER_TYPE) {
      toast.warning(t('editors.diagramTabs.maxDiagrams', { count: MAX_DIAGRAMS_PER_TYPE }));
      return;
    }
    dispatch(addDiagramThunk({ diagramType: currentDiagramType }));
    getPostHog()?.capture('diagram_created', { type: currentDiagramType });
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

  const selectClasses = "h-6 min-w-[120px] rounded-md border border-brand/15 bg-card px-2 text-[11px] font-medium text-foreground shadow-sm transition-colors hover:border-brand/30 focus:border-brand/40 focus:outline-none focus:ring-1 focus:ring-brand/20";

  return (
    <div className="relative overflow-visible border-b border-brand/12 bg-card/80 backdrop-blur-sm">
      {/* Top row: tabs */}
      <div className="flex items-center gap-0 px-1">
        <div className="flex items-end gap-px py-1 pl-1">
          {diagrams.map((diagram: ProjectDiagram, index: number) => {
            const isActive = index === safeIndex;
            const isRenaming = renamingIndex === index;
            const userValidationStatus = currentDiagramType === 'UserDiagram'
              ? userModelValidationStatusById?.[diagram.id] ?? 'not_validated'
              : undefined;

            const validationBadge = userValidationStatus === 'valid'
              ? { label: t('editors.diagramTabs.validationValidated'), className: 'bg-emerald-500' }
              : userValidationStatus === 'errors'
                ? { label: t('editors.diagramTabs.validationIssues'), className: 'bg-red-500' }
                : userValidationStatus === 'stale'
                  ? { label: t('editors.diagramTabs.validationNeedsValidation'), className: 'bg-amber-500' }
                  : { label: t('editors.diagramTabs.validationNotValidated'), className: 'bg-slate-400' };

            return (
              <div
                key={diagram.id}
                role="tab"
                aria-selected={isActive}
                aria-label={t('editors.diagramTabs.diagramTabLabel', { title: diagram.title })}
                className={[
                  'group relative flex cursor-pointer select-none items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-all duration-150',
                  isActive
                    ? 'border-b-2 border-brand bg-card text-brand-dark shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_0_1px_hsl(var(--brand)/0.1)]'
                    : 'text-muted-foreground hover:bg-brand/[0.04] hover:text-foreground',
                ].join(' ')}
                onClick={() => {
                  void handleSwitchTab(index);
                }}
                onDoubleClick={() => handleStartRename(index)}
              >
                {isRenaming ? (
                  <Input
                    className="h-5 w-24 rounded-sm border-input bg-card px-1.5 py-0 text-[11px] shadow-inner focus-visible:ring-1 focus-visible:ring-ring"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={handleFinishRename}
                    onKeyDown={handleRenameKeyDown}
                    autoFocus
                    aria-label={t('editors.diagramTabs.renameDiagram')}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <FileText className={`size-3 shrink-0 ${isActive ? 'text-brand' : 'text-muted-foreground'}`} />
                    <span className="max-w-[140px] truncate">{diagram.title}</span>
                    {currentDiagramType === 'UserDiagram' && (
                      <span
                        className={`size-2 rounded-full ${validationBadge.className}`}
                        title={validationBadge.label}
                        aria-label={t('editors.diagramTabs.validationStatusLabel', { status: validationBadge.label })}
                      />
                    )}
                  </>
                )}

                {diagrams.length > 1 && !isRenaming && (
                  <button
                    className={[
                      'ml-0.5 rounded-sm p-0.5 transition-colors',
                      isActive
                        ? 'text-muted-foreground hover:bg-muted hover:text-destructive'
                        : 'invisible text-muted-foreground hover:bg-muted hover:text-destructive group-hover:visible',
                    ].join(' ')}
                    onClick={(e) => handleRemoveDiagram(e, index)}
                    aria-label={t('editors.diagramTabs.closeTabLabel', { title: diagram.title })}
                    title={t('editors.diagramTabs.closeTab')}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Add button */}
          {diagrams.length < MAX_DIAGRAMS_PER_TYPE && (
            <button
              className="ml-0.5 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-brand/[0.06] hover:text-brand"
              onClick={handleAddDiagram}
              aria-label={t('editors.diagramTabs.addNewDiagram')}
              title={t('editors.diagramTabs.addNewDiagram')}
            >
              <Plus className="size-3.5" />
            </button>
          )}
        </div>

        {/* Open the forms-based User Profile editor (UserDiagram only) */}
        {isUserDiagram && (
          <button
            className={[
              'ml-auto mr-1.5 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold shadow-sm transition-colors',
              profileFormOpen
                ? 'bg-brand-dark text-brand-foreground hover:bg-brand-dark/90'
                : 'bg-brand text-brand-foreground hover:bg-brand-dark',
            ].join(' ')}
            onClick={() => setProfileFormOpen((prev) => !prev)}
            aria-pressed={profileFormOpen}
            title={profileFormOpen ? 'Close the user profile form' : 'Edit this profile with a guided form'}
          >
            <ClipboardList className="size-3.5" />
            <span>{profileFormOpen ? 'Close Form' : 'Edit as Form'}</span>
          </button>
        )}

        {/* Collapse toggle for references (inline in tab bar, right-aligned) */}
        {hasReferences && (
          <button
            className="ml-auto mr-1 flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => setRefsCollapsed((prev) => !prev)}
            aria-label={refsCollapsed ? t('editors.diagramTabs.expandLinkedDiagrams') : t('editors.diagramTabs.collapseLinkedDiagrams')}
            aria-expanded={!refsCollapsed}
            title={refsCollapsed ? t('editors.diagramTabs.showLinkedDiagrams') : t('editors.diagramTabs.hideLinkedDiagrams')}
          >
            <Link2 className="size-3" />
            <span className="hidden sm:inline">{t('editors.diagramTabs.linkedDiagrams')}</span>
            {refsCollapsed ? (
              <ChevronRight className="size-3" />
            ) : (
              <ChevronDown className="size-3" />
            )}
          </button>
        )}
      </div>

      {/* Linked Diagrams reference section (below tabs) */}
      {hasReferences && !refsCollapsed && (
        <div className="overflow-visible border-t border-border/40 bg-muted/30 px-3 py-1.5">
          <div className="flex flex-wrap items-center gap-4">
            {/* Section header */}
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Link2 className="size-3" />
              {t('editors.diagramTabs.references')}
            </span>

            {/* ClassDiagram reference */}
            {needsClassRef && (
              <div className="flex items-center gap-2">
                <label
                  htmlFor="ref-class-diagram"
                  className="whitespace-nowrap text-[11px] font-medium text-muted-foreground"
                >
                  {t('editors.diagramTabs.classDiagram')}
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
                          {t('editors.diagramTabs.referenceBroken')}
                        </option>
                      )}
                      {classDiagrams.map((cd) => (
                        <option key={cd.id} value={cd.id}>
                          {cd.title}
                        </option>
                      ))}
                    </select>
                    {classRefBroken && (
                      <span title={t('editors.diagramTabs.referenceDeleted')}>
                        <AlertTriangle className="size-3.5 text-amber-500 dark:text-amber-400" />
                      </span>
                    )}
                    {!classRefBroken && classRefEmpty && (
                      <span title={t('editors.diagramTabs.referenceEmpty')}>
                        <AlertTriangle className="size-3 text-muted-foreground" />
                      </span>
                    )}
                    {currentDiagramType === 'ObjectDiagram' && !classRefBroken && !classRefEmpty && (
                      <>
                        <button
                          type="button"
                          className="ml-1 inline-flex items-center gap-1 rounded-md border border-brand/15 bg-card px-2 py-0.5 text-[11px] font-medium text-foreground shadow-sm transition-colors hover:border-brand/30 hover:bg-brand/[0.04] focus:outline-none focus:ring-1 focus:ring-brand/20"
                          onClick={() => void handleGenerateObjectsFromClasses()}
                          title={t('editors.diagramTabs.generateObjectsTooltip')}
                        >
                          <Wand2 className="size-3" />
                          {t('editors.diagramTabs.generate')}
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md border border-brand/15 bg-card px-2 py-0.5 text-[11px] font-medium text-foreground shadow-sm transition-colors hover:border-brand/30 hover:bg-brand/[0.04] focus:outline-none focus:ring-1 focus:ring-brand/20"
                          onClick={handleGenerateSat}
                          title={t('editors.diagramTabs.semanticGenerationTooltip')}
                        >
                          <Wand2 className="size-3" />
                          {t('editors.diagramTabs.semanticGeneration')}
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <span className="rounded-md border border-dashed border-border bg-muted/30 px-2 py-0.5 text-[11px] italic text-muted-foreground">
                    {t('editors.diagramTabs.noClassDiagramsAvailable')}
                  </span>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {isUserDiagram && (
        <UserProfileFormPanel
          open={profileFormOpen}
          onClose={() => setProfileFormOpen(false)}
          editor={apollonEditor}
        />
      )}
    </div>
  );
};
