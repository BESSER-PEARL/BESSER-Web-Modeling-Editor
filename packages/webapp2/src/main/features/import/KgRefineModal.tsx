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

type TabKey = 'static' | 'llm';
type LlmPhase = 'input' | 'review';
type DiagramTypeArg = 'ClassDiagram' | 'ObjectDiagram';

const DIAGRAM_TYPE_BY_TARGET: Record<KgConversionTarget, DiagramTypeArg> = {
  kg_to_class: 'ClassDiagram',
  kg_to_object: 'ObjectDiagram',
};

const DIAGRAM_LABEL_BY_TARGET: Record<KgConversionTarget, string> = {
  kg_to_class: 'Class Diagram',
  kg_to_object: 'Object Diagram',
};

export interface KgRefineModalProps {
  open: boolean;
  onClose: () => void;
  onFixInKg?: (issue: KgIssue) => void;
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
  convertTarget,
  onConvert,
}) => {
  const { apiKey, setApiKey } = useOpenAIApiKey();
  const refine = useKgRefine();
  const diagramType: DiagramTypeArg = convertTarget
    ? DIAGRAM_TYPE_BY_TARGET[convertTarget]
    : 'ClassDiagram';
  const diagramLabel = convertTarget ? DIAGRAM_LABEL_BY_TARGET[convertTarget] : null;

  const [activeTab, setActiveTab] = useState<TabKey>('static');
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
      setActiveTab('static');
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
      refine.reset();
    }
  }, [open, refine]);

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
    if (typeof window !== 'undefined' && !window.confirm('Replace your current KG with the cleaned graph?')) {
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
    ? `Classify ${pendingOrphan.nodeIds.length}`
    : undefined;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {convertTarget
              ? `Refine before converting to ${diagramLabel}`
              : 'Refine Knowledge Graph'}
          </DialogTitle>
          <DialogDescription>
            {convertTarget
              ? `Resolve any inconsistencies in the Knowledge Graph. Once it is clean you can convert it to a ${diagramLabel}.`
              : 'Clean up the KG before converting it to B-UML. Review automatic recommendations from BESSER, or get AI-driven suggestions targeted at the system you want to build.'}
          </DialogDescription>
        </DialogHeader>

        <div
          role="tablist"
          aria-label="Refine KG tabs"
          className="-mx-6 flex border-b border-border px-6"
        >
          {tabButton('static', 'Automatic')}
          {tabButton('llm', 'AI', llmTabBadge)}
        </div>

        {activeTab === 'static' && (
          <div role="tabpanel" data-testid="kg-refine-panel-static" className="space-y-3">
            {refine.staticStatus === 'loading' && (
              <p className="text-sm text-muted-foreground">Analyzing KG…</p>
            )}
            {refine.staticStatus === 'success' && refine.staticReport && (
              <>
                {refine.staticReport.issues.length === 0 ? (
                  convertTarget ? (
                    <div
                      data-testid="kg-refine-convert-ready"
                      className="rounded border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
                    >
                      <p className="font-medium">
                        The Knowledge Graph has no remaining inconsistencies.
                      </p>
                      <p className="mt-1 text-xs">
                        Click <strong>Convert</strong> to generate the {diagramLabel}.
                      </p>
                    </div>
                  ) : (
                    <p
                      data-testid="kg-refine-static-empty"
                      className="text-sm text-muted-foreground"
                    >
                      No automatic recommendations — the KG looks clean.
                    </p>
                  )
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        Tick the suggestions you want to fix. For each one, choose
                        whether to apply the recommended fix or send it to the LLM.
                        Use “Fix in KG” to handle one manually in the canvas.
                      </span>
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
                          Select all
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
                          Deselect all
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
                          <>No suggestions selected — nothing will change.</>
                        ) : (
                          <>
                            <span className="font-medium text-foreground">
                              {split.selected}
                            </span>{' '}
                            of {refine.staticReport.issues.length} will be fixed:{' '}
                            <span data-testid="kg-refine-static-summary-recommended">
                              {split.recommended} via recommended
                            </span>
                            {' + '}
                            <span data-testid="kg-refine-static-summary-llm">
                              {split.llm} via LLM
                            </span>
                            .
                          </>
                        )}
                      </p>
                    );
                  })()}
                <DialogFooter>
                  <Button variant="outline" onClick={onClose} disabled={isApplyingStatic}>
                    Close
                  </Button>
                  {convertTarget && refine.staticReport.issues.length === 0 ? (
                    <Button
                      onClick={handleConvert}
                      disabled={isApplyingStatic}
                      data-testid="kg-refine-convert"
                    >
                      Convert to {diagramLabel}
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
                        ? 'Applying…'
                        : (() => {
                            const split = _computeSelectionSplit(
                              refine.staticReport.issues,
                              staticDecisions,
                              staticRouting,
                            );
                            if (split.llm > 0 && split.recommended > 0) {
                              return `Apply ${split.selected} (${split.recommended} rec + ${split.llm} LLM)`;
                            }
                            if (split.llm > 0) {
                              return `Send ${split.llm} to LLM`;
                            }
                            return `Apply ${split.selected} recommended`;
                          })()}
                    </Button>
                  )}
                </DialogFooter>
              </>
            )}
            {refine.staticStatus === 'error' && (
              <div className="space-y-2">
                <p className="text-sm text-red-600 dark:text-red-400">
                  Failed to analyze the KG. Try again.
                </p>
                <Button variant="outline" onClick={() => refine.runStatic('ClassDiagram')}>
                  Retry
                </Button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'llm' && (
          <div role="tabpanel" data-testid="kg-refine-panel-llm" className="space-y-3">
            {pendingOrphan && llmPhase === 'input' && (
              <div
                data-testid="kg-refine-pending-orphan-banner"
                className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
              >
                Ready to classify <strong>{pendingOrphan.nodeIds.length}</strong> orphan
                node(s) flagged in the Automatic tab. Provide a description and
                API key, then Analyze to ask the LLM for per-node classifications.
              </div>
            )}

            {!pendingOrphan && llmDeferredIds.length > 0 && llmPhase === 'input' && (
              <div
                data-testid="kg-refine-deferred-banner"
                className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
              >
                <strong>{llmDeferredIds.length}</strong> issue(s) were routed here from
                the Automatic tab. Describe the system you want to build, then
                Analyze to ask the LLM for fixes against the (now partially-cleaned) KG.
              </div>
            )}

            {llmPhase === 'input' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="kg-refine-description">System description</Label>
                  <textarea
                    id="kg-refine-description"
                    data-testid="kg-refine-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. A library management system that tracks books, members, and loans."
                    rows={5}
                    className="block w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground/90"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="kg-refine-api-key">OpenAI API key</Label>
                  <Input
                    id="kg-refine-api-key"
                    data-testid="kg-refine-api-key"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">
                    Stored in this browser session only.
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={onClose} disabled={refine.llmStatus === 'loading'}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleLlmAnalyze}
                    disabled={!canAnalyzeLlm}
                    data-testid="kg-refine-llm-analyze"
                  >
                    {refine.llmStatus === 'loading' ? 'Analyzing…' : 'Analyze'}
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
                    The LLM did not suggest any changes for the described system.
                  </p>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        Tick the suggestions you want to apply. Skip the rest, or use
                        “Fix in KG” to handle one manually in the canvas.
                      </span>
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
                          Select all
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
                          Deselect all
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
                    Back
                  </Button>
                  <Button variant="outline" onClick={onClose} disabled={isApplyingLlm}>
                    Cancel
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
                      ? 'Applying…'
                      : `Apply ${_countAccepted(
                          refine.llmReport.issues,
                          llmDecisions,
                        )} selected`}
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
