// Unified Refine KG modal.
//
// Two tabs:
//   - Automatic: runs the static analyzer on mount, lets the user accept/skip
//                each issue, and applies via /apply-kg-refinement (source=static).
//                For ORPHAN_NODE_NO_CLASS_LINK issues, "skip" defers the orphan
//                set to LLM classification; the apply response carries
//                pendingOrphanClassification which auto-switches to the AI tab.
//   - AI:       phase 'input' (description + API key) → phase 'review'.
//                If pending orphan node ids were carried over, the input phase
//                triggers /classify-orphans-with-llm; otherwise it triggers
//                /llm-clean-kg (full-graph). Apply via /apply-kg-refinement
//                (source=llm), then close the modal.
//
// Each tab owns its own decisions state; switching tabs preserves both.
//
// Convert mode: when ``convertTarget`` is set, the modal serves as the
// inconsistency-review surface for "Convert KG → Class/Object Diagram".
// After every apply (static or LLM) the analyzer is re-run instead of
// auto-closing. When the static analyzer reports zero remaining issues,
// the empty-state surfaces a "Convert to <diagram>" button that calls
// ``onConvert`` with the latest kgSignature.
import React, { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOpenAIApiKey } from '../../shared/hooks/useOpenAIApiKey';
import { KgPreflightIssueRow, type RowDecision, type RowRouting } from './KgPreflightIssueRow';
import { useKgRefine, type PendingOrphanClassification } from './useKgRefine';
import type { KgIssue, KgPreflightReport } from './useKgPreflight';
import type { KgConversionTarget } from './useKgToUmlConversion';
import { useKgConsistencyCheck } from './useKgConsistencyCheck';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { getActiveDiagram } from '../../shared/types/project';
import type { BesserProject, ConsistencyReport } from '../../shared/types/project';

type TabKey = 'static' | 'consistency' | 'llm';
type LlmPhase = 'input' | 'review';
type DiagramTypeArg = 'ClassDiagram' | 'ObjectDiagram';

const DIAGRAM_TYPE_BY_TARGET: Record<KgConversionTarget, DiagramTypeArg> = {
  kg_to_class: 'ClassDiagram',
  kg_to_object: 'ObjectDiagram',
};

/** Display-only, so it points at the existing `diagramTypes.*` keys rather
 *  than duplicating those strings. (The persisted diagram TITLE uses the
 *  untranslated suffix in `useKgToUmlConversion`.) */
const DIAGRAM_LABEL_KEY_BY_TARGET: Record<KgConversionTarget, string> = {
  kg_to_class: 'diagramTypes.ClassDiagram',
  kg_to_object: 'diagramTypes.ObjectDiagram',
};

export interface KgRefineModalProps {
  open: boolean;
  onClose: () => void;
  onFixInKg?: (issue: KgIssue) => void;
  /** Selects + zooms-to a set of node ids on the KG canvas, then closes the
   *  modal. Used by the Consistency tab's "Fix in KG" buttons to take the
   *  user straight to the offending node. */
  onFocusNodes?: (nodeIds: string[]) => void;
  /**
   * When set, the modal acts as the pre-conversion review surface for
   * the given target. Applies don't auto-close the modal; instead the
   * analyzer is re-run so the user sees remaining issues, and a
   * "Convert" button appears once the KG is clean.
   */
  convertTarget?: KgConversionTarget;
  /**
   * Called when the user clicks the Convert button (only available in
   * convert mode and only when the static analyzer reports zero issues).
   * The modal closes itself after invoking this callback.
   */
  onConvert?: (kgSignature: string) => void;
  /** Tab to focus when the modal opens. Defaults to "static". The
   *  pre-conversion gate uses "consistency" to deep-link the user
   *  straight into the new tab. */
  initialTab?: TabKey;
}

function _initialDecisions(issues: KgIssue[]): Record<string, RowDecision> {
  const out: Record<string, RowDecision> = {};
  for (const issue of issues) {
    out[issue.id] = 'accept';
  }
  return out;
}

function _countAccepted(
  issues: KgIssue[],
  decisions: Record<string, RowDecision>,
): number {
  return issues.reduce(
    (n, i) => n + ((decisions[i.id] ?? 'accept') === 'accept' ? 1 : 0),
    0,
  );
}

function _setAllDecisions(
  issues: KgIssue[],
  decision: RowDecision,
): Record<string, RowDecision> {
  const out: Record<string, RowDecision> = {};
  for (const issue of issues) {
    out[issue.id] = decision;
  }
  return out;
}

function _initialRouting(issues: KgIssue[]): Record<string, RowRouting> {
  // Default every selected suggestion to the rule-based recommendation;
  // the user can flip individual rows to LLM in the segmented control.
  const out: Record<string, RowRouting> = {};
  for (const issue of issues) {
    out[issue.id] = 'recommended';
  }
  return out;
}

interface SelectionSplit {
  selected: number;
  recommended: number;
  llm: number;
}

function _computeSelectionSplit(
  issues: KgIssue[],
  decisions: Record<string, RowDecision>,
  routing: Record<string, RowRouting>,
): SelectionSplit {
  let selected = 0;
  let recommended = 0;
  let llm = 0;
  for (const issue of issues) {
    if ((decisions[issue.id] ?? 'accept') !== 'accept') continue;
    selected += 1;
    if ((routing[issue.id] ?? 'recommended') === 'llm') {
      llm += 1;
    } else {
      recommended += 1;
    }
  }
  return { selected, recommended, llm };
}

export const KgRefineModal: React.FC<KgRefineModalProps> = ({
  open,
  onClose,
  onFixInKg,
  onFocusNodes,
  convertTarget,
  onConvert,
  initialTab,
}) => {
  const { t } = useTranslation();
  const { apiKey, setApiKey } = useOpenAIApiKey();
  const refine = useKgRefine();
  const diagramType: DiagramTypeArg = convertTarget
    ? DIAGRAM_TYPE_BY_TARGET[convertTarget]
    : 'ClassDiagram';
  const diagramLabel = convertTarget ? t(DIAGRAM_LABEL_KEY_BY_TARGET[convertTarget]) : null;

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab ?? 'static');
  // Consistency tab state — independent of static/LLM tabs.
  const checkConsistency = useKgConsistencyCheck();
  const [consistencyStatus, setConsistencyStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [consistencyReport, setConsistencyReport] = useState<ConsistencyReport | null>(null);
  const [consistencyError, setConsistencyError] = useState<string | null>(null);
  const [consistencyLastRun, setConsistencyLastRun] = useState<number | null>(null);
  const ranConsistencyRef = useRef(false);
  // Static tab decisions
  const [staticDecisions, setStaticDecisions] = useState<Record<string, RowDecision>>({});
  // Per-row routing choice for selected static issues: apply the
  // rule-based recommendation, or defer to the LLM tab.
  const [staticRouting, setStaticRouting] = useState<Record<string, RowRouting>>({});
  // Issue ids the user routed to LLM in the latest static apply. Used to
  // populate a banner on the AI tab so the user knows what to expect from
  // the follow-up LLM analysis.
  const [llmDeferredIds, setLlmDeferredIds] = useState<string[]>([]);
  const [isApplyingStatic, setIsApplyingStatic] = useState(false);
  // LLM tab state
  const [llmPhase, setLlmPhase] = useState<LlmPhase>('input');
  const [description, setDescription] = useState('');
  const [llmDecisions, setLlmDecisions] = useState<Record<string, RowDecision>>({});
  const [isApplyingLlm, setIsApplyingLlm] = useState(false);
  // Orphan-classification handoff from Automatic → AI tab
  const [pendingOrphan, setPendingOrphan] = useState<PendingOrphanClassification | null>(null);
  // Track the latest signature returned by the static apply so the LLM tab
  // can pass the right kgSignature to the apply leg.
  const [latestKgSignature, setLatestKgSignature] = useState<string | null>(null);

  // Track if static analysis has run for this open session.
  const ranStaticRef = useRef(false);

  // Reset internal state on close.
  useEffect(() => {
    if (!open) {
      setActiveTab(initialTab ?? 'static');
      setStaticDecisions({});
      setStaticRouting({});
      setLlmDeferredIds([]);
      setIsApplyingStatic(false);
      setLlmPhase('input');
      setDescription('');
      setLlmDecisions({});
      setIsApplyingLlm(false);
      setPendingOrphan(null);
      setLatestKgSignature(null);
      ranStaticRef.current = false;
      setConsistencyStatus('idle');
      setConsistencyReport(null);
      setConsistencyError(null);
      setConsistencyLastRun(null);
      ranConsistencyRef.current = false;
      refine.reset();
    }
  }, [open, refine, initialTab]);

  // Auto-run the static analyzer the first time the modal opens.
  useEffect(() => {
    if (!open || ranStaticRef.current) return;
    ranStaticRef.current = true;
    void refine.runStatic(diagramType).then((report) => {
      if (report) {
        setStaticDecisions(_initialDecisions(report.issues));
        setStaticRouting(_initialRouting(report.issues));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Consistency tab runner. Reads the active KG diagram from local storage,
  // calls /check-kg-consistency, and stores the report. Only invoked when
  // the user explicitly clicks the "Run check" / "Re-check" button — the
  // OWL/SHACL validation can be slow on large KGs, so we keep the user in
  // control of when it actually fires.
  const runConsistency = React.useCallback(async () => {
    const project = ProjectStorageRepository.getCurrentProject() as BesserProject | null;
    if (!project) {
      setConsistencyStatus('error');
      setConsistencyError(t('import.kg.refine.noProjectOpen'));
      return;
    }
    const kgDiagram = getActiveDiagram(project, 'KnowledgeGraphDiagram');
    if (!kgDiagram || !kgDiagram.model) {
      setConsistencyStatus('error');
      setConsistencyError(t('import.kg.refine.noActiveDiagram'));
      return;
    }
    setConsistencyStatus('loading');
    setConsistencyError(null);
    try {
      const report = await checkConsistency(kgDiagram);
      setConsistencyReport(report);
      setConsistencyStatus('success');
      setConsistencyLastRun(Date.now());
      ranConsistencyRef.current = true;
    } catch (err) {
      setConsistencyStatus('error');
      setConsistencyError(err instanceof Error ? err.message : t('import.kg.refine.consistencyFailed'));
    }
  }, [checkConsistency]);

  // Initialise / refresh LLM-tab decisions when a new LLM report arrives.
  useEffect(() => {
    if (refine.llmReport) {
      setLlmDecisions(_initialDecisions(refine.llmReport.issues));
      setLlmPhase('review');
    }
  }, [refine.llmReport]);

  const handleStaticDecisionChange = (issueId: string, decision: RowDecision) => {
    setStaticDecisions((prev) => ({ ...prev, [issueId]: decision }));
  };

  const handleStaticRoutingChange = (issueId: string, routing: RowRouting) => {
    setStaticRouting((prev) => ({ ...prev, [issueId]: routing }));
  };

  const handleLlmDecisionChange = (issueId: string, decision: RowDecision) => {
    setLlmDecisions((prev) => ({ ...prev, [issueId]: decision }));
  };

  const handleApplyStatic = async (current: KgPreflightReport) => {
    if (current.issues.length === 0) {
      onClose();
      return;
    }
    // Translate per-row state into the wire format the backend expects.
    //
    // Rules per row:
    //   not selected                    → omit       (issue left untouched in
    //                                                  the KG — backend ignores
    //                                                  any issue id absent from
    //                                                  the resolutions list).
    //   selected + routing=recommended  → 'accept'   (backend dispatches the
    //                                                  pre-computed recommended
    //                                                  action).
    //   selected + routing=llm
    //     issue.code = ORPHAN_NODE_NO_CLASS_LINK
    //                                   → 'skip'     (the backend's skip_action
    //                                                  for orphans raises
    //                                                  DeferredOrphanClassification,
    //                                                  which the apply route
    //                                                  collects into
    //                                                  pendingOrphanClassification).
    //     other codes
    //                                   → omit       (sending 'skip' would
    //                                                  invoke a destructive
    //                                                  skip_action like
    //                                                  drop_property; we want
    //                                                  the issue left intact so
    //                                                  the LLM can address it
    //                                                  in the AI tab).
    //
    // We track the LLM-routed ids in `deferred` regardless of code so the
    // AI tab can show its banner with the right count.
    const deferred: string[] = [];
    const decisions: Array<{ issueId: string; decision: RowDecision }> = [];
    for (const issue of current.issues) {
      const isSelected = (staticDecisions[issue.id] ?? 'accept') === 'accept';
      if (!isSelected) continue;
      const route = staticRouting[issue.id] ?? 'recommended';
      if (route === 'recommended') {
        decisions.push({ issueId: issue.id, decision: 'accept' });
      } else {
        deferred.push(issue.id);
        if (issue.code === 'ORPHAN_NODE_NO_CLASS_LINK') {
          decisions.push({ issueId: issue.id, decision: 'skip' });
        }
        // Other codes: omitted on purpose — see comment above.
      }
    }
    setIsApplyingStatic(true);
    try {
      const result = await refine.applyStatic(decisions, current.kgSignature, diagramType);
      if (!result) return;
      setLatestKgSignature(result.newKgSignature);
      setLlmDeferredIds(deferred);
      // Routing precedence: the existing orphan-classification handoff
      // wins (orphan flow is bespoke and already wired); otherwise, if
      // the user routed any issue to LLM, switch to the AI tab so they
      // can run the LLM cleanup against the freshly-applied KG.
      if (
        result.pendingOrphanClassification &&
        result.pendingOrphanClassification.nodeIds.length > 0
      ) {
        setPendingOrphan(result.pendingOrphanClassification);
        setActiveTab('llm');
        setLlmPhase('input');
      } else if (deferred.length > 0) {
        setActiveTab('llm');
        setLlmPhase('input');
      } else if (convertTarget) {
        // Convert mode: don't close. Re-run the analyzer so the user
        // sees what's left (and the Convert button appears when clean).
        const refreshed = await refine.runStatic(diagramType);
        if (refreshed) {
          setStaticDecisions(_initialDecisions(refreshed.issues));
          setStaticRouting(_initialRouting(refreshed.issues));
        }
      } else {
        onClose();
      }
    } finally {
      setIsApplyingStatic(false);
    }
  };

  const handleLlmAnalyze = async () => {
    if (pendingOrphan) {
      await refine.runLlmOrphanClassification(
        description,
        apiKey,
        pendingOrphan.nodeIds,
        pendingOrphan.kgSignature,
      );
    } else {
      await refine.runLlmFullCleanup(description, apiKey);
    }
    // Phase transition is driven by the effect above when a report arrives.
  };

  const handleApplyLlm = async (current: KgPreflightReport) => {
    if (current.issues.length === 0) {
      onClose();
      return;
    }
    const decisions = current.issues.map((i) => ({
      issueId: i.id,
      decision: llmDecisions[i.id] ?? 'accept',
    }));
    // window.confirm's OK/Cancel follow the browser locale, not the app's.
    if (typeof window !== 'undefined' && !window.confirm(t('import.kg.refine.confirmReplace'))) {
      return;
    }
    setIsApplyingLlm(true);
    try {
      const ok = await refine.applyLlm(decisions, current.issues, current.kgSignature);
      if (!ok) return;
      if (convertTarget) {
        // Convert mode: keep the modal open and re-run the static
        // analyzer so the user can see the cleaned KG and convert when
        // it's free of inconsistencies. Switch back to the Automatic
        // tab so the Convert button is visible.
        const refreshed = await refine.runStatic(diagramType);
        if (refreshed) {
          setStaticDecisions(_initialDecisions(refreshed.issues));
          setStaticRouting(_initialRouting(refreshed.issues));
        }
        setLlmDeferredIds([]);
        setPendingOrphan(null);
        setActiveTab('static');
      } else {
        onClose();
      }
    } finally {
      setIsApplyingLlm(false);
    }
  };

  const handleConvert = () => {
    if (!convertTarget || !onConvert) return;
    const sig = latestKgSignature ?? refine.staticReport?.kgSignature;
    if (!sig) return;
    onConvert(sig);
    onClose();
  };

  const handleFixInKg = (issue: KgIssue) => {
    onFixInKg?.(issue);
    onClose();
  };

  const canAnalyzeLlm =
    description.trim().length > 0 &&
    apiKey.trim().length > 0 &&
    refine.llmStatus !== 'loading';

  const tabButton = (key: TabKey, label: string, badge?: string) => (
    <button
      key={key}
      type="button"
      onClick={() => setActiveTab(key)}
      data-testid={`kg-refine-tab-${key}`}
      className={
        activeTab === key
          ? 'border-b-2 border-primary px-4 py-2 text-sm font-medium text-primary'
          : 'border-b-2 border-transparent px-4 py-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
      }
    >
      <span>{label}</span>
      {badge && (
        <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900 dark:text-amber-200">
          {badge}
        </span>
      )}
    </button>
  );

  const llmTabBadge = pendingOrphan
    ? t('import.kg.refine.classifyBadge', { count: pendingOrphan.nodeIds.length })
    : undefined;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {convertTarget
              ? t('import.kg.refine.titleConvert', { diagram: diagramLabel })
              : t('import.kg.refine.title')}
          </DialogTitle>
          <DialogDescription>
            {convertTarget
              ? t('import.kg.refine.descriptionConvert', { diagram: diagramLabel })
              : t('import.kg.refine.description')}
          </DialogDescription>
        </DialogHeader>

        <div
          role="tablist"
          aria-label={t('import.kg.refine.tabsAria')}
          className="-mx-6 flex border-b border-border px-6"
        >
          {tabButton('static', t('import.kg.refine.tabAutomatic'))}
          {tabButton(
            'consistency',
            t('import.kg.refine.tabConsistency'),
            consistencyReport && consistencyReport.issueCount > 0
              ? String(consistencyReport.issueCount)
              : undefined,
          )}
          {tabButton('llm', t('import.kg.refine.tabAi'), llmTabBadge)}
        </div>

        {activeTab === 'static' && (
          <div role="tabpanel" data-testid="kg-refine-panel-static" className="min-w-0 space-y-3">
            {refine.staticStatus === 'loading' && (
              <p className="text-sm text-muted-foreground">{t('import.kg.refine.analyzingKg')}</p>
            )}
            {refine.staticStatus === 'success' && refine.staticReport && (
              <>
                {refine.staticReport.issues.length === 0 ? (
                  convertTarget ? (
                    <div
                      data-testid="kg-refine-convert-ready"
                      className="rounded border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
                    >
                      <p className="font-medium">{t('import.kg.refine.noInconsistencies')}</p>
                      <p className="mt-1 text-xs">
                        <Trans
                          i18nKey="import.kg.refine.clickConvert"
                          values={{ diagram: diagramLabel }}
                          components={{ action: <strong /> }}
                        />
                      </p>
                    </div>
                  ) : (
                    <p
                      data-testid="kg-refine-static-empty"
                      className="text-sm text-muted-foreground"
                    >
                      {t('import.kg.refine.noRecommendations')}
                    </p>
                  )
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{t('import.kg.refine.staticInstructions')}</span>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setStaticDecisions(
                              _setAllDecisions(refine.staticReport!.issues, 'accept'),
                            )
                          }
                          data-testid="kg-refine-static-select-all"
                        >
                          {t('import.kg.refine.selectAll')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setStaticDecisions(
                              _setAllDecisions(refine.staticReport!.issues, 'skip'),
                            )
                          }
                          data-testid="kg-refine-static-deselect-all"
                        >
                          {t('import.kg.refine.deselectAll')}
                        </Button>
                      </div>
                    </div>
                    <div
                      data-testid="kg-refine-static-issue-list"
                      className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto"
                    >
                      {refine.staticReport.issues.map((issue) => (
                        <KgPreflightIssueRow
                          key={issue.id}
                          issue={issue}
                          decision={staticDecisions[issue.id] ?? 'accept'}
                          onDecisionChange={handleStaticDecisionChange}
                          onFixInKg={handleFixInKg}
                          alwaysShowFixInKg
                          enableRoutingChoice
                          routing={staticRouting[issue.id] ?? 'recommended'}
                          onRoutingChange={handleStaticRoutingChange}
                        />
                      ))}
                    </div>
                  </>
                )}
                {refine.staticReport.issues.length > 0 &&
                  (() => {
                    const split = _computeSelectionSplit(
                      refine.staticReport.issues,
                      staticDecisions,
                      staticRouting,
                    );
                    return (
                      <p
                        data-testid="kg-refine-static-summary"
                        className="text-xs text-muted-foreground"
                      >
                        {split.selected === 0 ? (
                          <>{t('import.kg.refine.noneSelected')}</>
                        ) : (
                          <>
                            <span className="font-medium text-foreground">
                              {split.selected}
                            </span>{' '}
                            {t('import.kg.refine.ofWillBeFixed', {
                              total: refine.staticReport.issues.length,
                            })}{' '}
                            <span data-testid="kg-refine-static-summary-recommended">
                              {t('import.kg.refine.viaRecommended', { count: split.recommended })}
                            </span>
                            {' + '}
                            <span data-testid="kg-refine-static-summary-llm">
                              {t('import.kg.refine.viaLlm', { count: split.llm })}
                            </span>
                            .
                          </>
                        )}
                      </p>
                    );
                  })()}
                <DialogFooter>
                  <Button variant="outline" onClick={onClose} disabled={isApplyingStatic}>
                    {t('common.close')}
                  </Button>
                  {convertTarget && refine.staticReport.issues.length === 0 ? (
                    <Button
                      onClick={handleConvert}
                      disabled={isApplyingStatic}
                      data-testid="kg-refine-convert"
                    >
                      {t('import.kg.refine.convertTo', { diagram: diagramLabel })}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleApplyStatic(refine.staticReport!)}
                      disabled={
                        isApplyingStatic ||
                        refine.staticReport.issues.length === 0 ||
                        _computeSelectionSplit(
                          refine.staticReport.issues,
                          staticDecisions,
                          staticRouting,
                        ).selected === 0
                      }
                      data-testid="kg-refine-static-apply"
                    >
                      {isApplyingStatic
                        ? t('import.kg.refine.applying')
                        : (() => {
                            const split = _computeSelectionSplit(
                              refine.staticReport.issues,
                              staticDecisions,
                              staticRouting,
                            );
                            if (split.llm > 0 && split.recommended > 0) {
                              return t('import.kg.refine.applyMixed', {
                                count: split.selected,
                                recommended: split.recommended,
                                llm: split.llm,
                              });
                            }
                            if (split.llm > 0) {
                              return t('import.kg.refine.sendToLlm', { count: split.llm });
                            }
                            return t('import.kg.refine.applyRecommended', { count: split.selected });
                          })()}
                    </Button>
                  )}
                </DialogFooter>
              </>
            )}
            {refine.staticStatus === 'error' && (
              <div className="space-y-2">
                <p className="text-sm text-red-600 dark:text-red-400">{t('import.kg.refine.analyzeFailed')}</p>
                <Button variant="outline" onClick={() => refine.runStatic('ClassDiagram')}>
                  {t('import.kg.refine.retry')}
                </Button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'consistency' && (
          <div role="tabpanel" data-testid="kg-refine-panel-consistency" className="min-w-0 space-y-3">
            <p className="text-xs text-muted-foreground">
              <Trans
                i18nKey="import.kg.refine.consistencyExplainer"
                values={{ action: t('import.kg.refine.runCheck') }}
                components={{ action: <strong /> }}
              />
            </p>
            {consistencyStatus === 'idle' && (
              <div
                data-testid="kg-refine-consistency-idle"
                className="rounded border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground"
              >
                <Trans
                  i18nKey="import.kg.refine.consistencyIdle"
                  values={{ action: t('import.kg.refine.runCheck') }}
                  components={{ action: <strong /> }}
                />
              </div>
            )}
            {consistencyStatus === 'loading' && (
              <p className="text-sm text-muted-foreground">{t('import.kg.refine.checkingConsistency')}</p>
            )}
            {consistencyStatus === 'error' && (
              <p className="text-sm text-destructive" data-testid="kg-refine-consistency-error">
                {consistencyError ?? t('import.kg.refine.consistencyFailed')}
              </p>
            )}
            {consistencyStatus === 'success' && consistencyReport && (
              <>
                {consistencyReport.issueCount === 0 ? (
                  <div
                    data-testid="kg-refine-consistency-empty"
                    className="rounded border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
                  >
                    <p className="font-medium">{t('import.kg.refine.allSatisfied')}</p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {t('import.kg.refine.severitySummary', {
                        violations: t('import.kg.consistency.violationsFragment', {
                          count: consistencyReport.severityCounts.violation,
                        }),
                        warnings: t('import.kg.consistency.warningsFragment', {
                          count: consistencyReport.severityCounts.warning,
                        }),
                        info: consistencyReport.severityCounts.info,
                      })}
                      {consistencyLastRun &&
                        t('import.kg.refine.lastRun', {
                          time: new Date(consistencyLastRun).toLocaleTimeString(),
                        })}
                    </p>
                    <ul className="max-h-[420px] divide-y divide-border overflow-y-auto rounded border border-border">
                      {consistencyReport.issues.map((issue) => {
                        const tone =
                          issue.severity === 'violation'
                            ? 'border-l-4 border-l-red-500'
                            : issue.severity === 'warning'
                              ? 'border-l-4 border-l-amber-500'
                              : 'border-l-4 border-l-sky-500';
                        const hasTargets = issue.affected_node_ids.length > 0;
                        return (
                          <li
                            key={issue.id}
                            data-testid={`kg-refine-consistency-issue-${issue.id}`}
                            className={`px-3 py-2 text-sm ${tone}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                {issue.constraint_label ? (
                                  <>
                                    <div className="font-medium">{issue.constraint_label}</div>
                                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                                      {issue.message}
                                    </div>
                                  </>
                                ) : (
                                  <div className="font-medium">{issue.message}</div>
                                )}
                                <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                                  <span className="rounded bg-muted px-1.5 py-0.5 uppercase tracking-wide">
                                    {issue.severity}
                                  </span>
                                  {issue.spec_kind && (
                                    <span className="rounded bg-purple-100 px-1.5 py-0.5 text-purple-900 dark:bg-purple-900 dark:text-purple-100">
                                      {issue.spec_kind}
                                    </span>
                                  )}
                                  {hasTargets && (
                                    <span className="truncate">
                                      {t('import.kg.consistency.onNode', {
                                        nodeId: issue.affected_node_ids[0],
                                      })}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {hasTargets && onFocusNodes && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 shrink-0 text-xs"
                                  onClick={() => {
                                    // Include the constraint node id so the
                                    // focused view shows both the offending
                                    // individual AND the constraint that was
                                    // violated (with maxNeighbors:15 the focus
                                    // helper then pulls in the linked
                                    // class / property / NodeConstraint chain).
                                    const ids = [...issue.affected_node_ids];
                                    if (
                                      issue.constraint_node_id &&
                                      !ids.includes(issue.constraint_node_id)
                                    ) {
                                      ids.push(issue.constraint_node_id);
                                    }
                                    onFocusNodes(ids);
                                    onClose();
                                  }}
                                  data-testid={`kg-refine-consistency-fix-${issue.id}`}
                                >
                                  {t('import.kg.preflight.fixInKg')}
                                </Button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </>
            )}
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => void runConsistency()}
                disabled={consistencyStatus === 'loading'}
                data-testid="kg-refine-consistency-recheck"
              >
                {consistencyStatus === 'idle' ? t('import.kg.refine.runCheck') : t('import.kg.refine.reCheck')}
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'llm' && (
          <div role="tabpanel" data-testid="kg-refine-panel-llm" className="min-w-0 space-y-3">
            {pendingOrphan && llmPhase === 'input' && (
              <div
                data-testid="kg-refine-pending-orphan-banner"
                className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
              >
                <Trans
                  i18nKey="import.kg.refine.orphanBanner"
                  count={pendingOrphan.nodeIds.length}
                  components={{ count: <strong /> }}
                />
              </div>
            )}

            {!pendingOrphan && llmDeferredIds.length > 0 && llmPhase === 'input' && (
              <div
                data-testid="kg-refine-deferred-banner"
                className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
              >
                <Trans
                  i18nKey="import.kg.refine.deferredBanner"
                  count={llmDeferredIds.length}
                  components={{ count: <strong /> }}
                />
              </div>
            )}

            {llmPhase === 'input' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="kg-refine-description">{t('import.kg.refine.systemDescription')}</Label>
                  <textarea
                    id="kg-refine-description"
                    data-testid="kg-refine-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('import.kg.refine.systemDescriptionPlaceholder')}
                    rows={5}
                    className="block w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground/90"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="kg-refine-api-key">{t('import.kg.refine.apiKey')}</Label>
                  <Input
                    id="kg-refine-api-key"
                    data-testid="kg-refine-api-key"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">{t('import.kg.refine.apiKeyNote')}</p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={onClose} disabled={refine.llmStatus === 'loading'}>
                    {t('common.cancel')}
                  </Button>
                  <Button
                    onClick={handleLlmAnalyze}
                    disabled={!canAnalyzeLlm}
                    data-testid="kg-refine-llm-analyze"
                  >
                    {refine.llmStatus === 'loading' ? t('import.kg.refine.analyzing') : t('import.kg.refine.analyze')}
                  </Button>
                </DialogFooter>
              </>
            )}

            {llmPhase === 'review' && refine.llmReport && (
              <>
                {refine.llmReport.issues.length === 0 ? (
                  <p
                    data-testid="kg-refine-llm-empty"
                    className="text-sm text-muted-foreground"
                  >
                    {t('import.kg.refine.llmNoSuggestions')}
                  </p>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{t('import.kg.refine.llmInstructions')}</span>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setLlmDecisions(
                              _setAllDecisions(refine.llmReport!.issues, 'accept'),
                            )
                          }
                          data-testid="kg-refine-llm-select-all"
                        >
                          {t('import.kg.refine.selectAll')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setLlmDecisions(
                              _setAllDecisions(refine.llmReport!.issues, 'skip'),
                            )
                          }
                          data-testid="kg-refine-llm-deselect-all"
                        >
                          {t('import.kg.refine.deselectAll')}
                        </Button>
                      </div>
                    </div>
                    <div
                      data-testid="kg-refine-llm-issue-list"
                      className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto"
                    >
                      {refine.llmReport.issues.map((issue) => (
                        <KgPreflightIssueRow
                          key={issue.id}
                          issue={issue}
                          decision={llmDecisions[issue.id] ?? 'accept'}
                          onDecisionChange={handleLlmDecisionChange}
                          onFixInKg={handleFixInKg}
                          alwaysShowFixInKg
                        />
                      ))}
                    </div>
                  </>
                )}
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setLlmPhase('input');
                    }}
                    disabled={isApplyingLlm}
                  >
                    {t('import.kg.refine.back')}
                  </Button>
                  <Button variant="outline" onClick={onClose} disabled={isApplyingLlm}>
                    {t('common.cancel')}
                  </Button>
                  <Button
                    onClick={() => handleApplyLlm(refine.llmReport!)}
                    disabled={
                      isApplyingLlm ||
                      refine.llmReport.issues.length === 0 ||
                      _countAccepted(refine.llmReport.issues, llmDecisions) === 0
                    }
                    data-testid="kg-refine-llm-apply"
                  >
                    {isApplyingLlm
                      ? t('import.kg.refine.applying')
                      : t('import.kg.refine.applySelected', {
                          count: _countAccepted(refine.llmReport.issues, llmDecisions),
                        })}
                  </Button>
                </DialogFooter>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
