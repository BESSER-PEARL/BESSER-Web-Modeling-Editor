import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ApollonEditor,
  ApollonMode,
  UMLDiagramType,
  Locale,
  type UMLModel,
  type UMLRelationship,
  type Patch,
} from '@besser/wme';
import { Bot, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppSelector } from '@/main/app/store/hooks';
import { selectActiveDiagram } from '@/main/app/store/workspaceSlice';
import { selectStdoutLines } from '@/main/features/agent-simulation';
import { isUMLModel } from '@/main/shared/types/project';

const ACTIVE_STATE_FILL = '#03d7fc';
const ACTIVE_TRANSITION_STROKE = '#03d7fc';
const AGENT_STATE_TYPE = 'AgentState';
const AGENT_TRANSITION_TYPE = 'AgentStateTransition';

interface TransitionEntry {
  event: string;
  from: string;
  to: string;
}

function parseTransitionLog(line: string): TransitionEntry | null {
  const arrowMatch = line.match(/\[([^\]]+)\]\s*-->\s*\[([^\]]+)\]/);
  if (!arrowMatch) return null;
  const from = arrowMatch[1].trim();
  const to = arrowMatch[2].trim();
  let beforeArrow = line.slice(0, arrowMatch.index!).trimEnd().replace(/:?\s*$/, '').trimEnd();
  const infoIdx = beforeArrow.search(/\bINFO\b/i);
  let candidate = infoIdx >= 0 ? beforeArrow.slice(infoIdx + 4) : beforeArrow;
  candidate = candidate.replace(/^[\s\-:]+/, '');
  if (/^\d/.test(candidate)) {
    const colonIdx = candidate.indexOf(': ');
    if (colonIdx >= 0) candidate = candidate.slice(colonIdx + 2);
  }
  const event = candidate.replace(/:?\s*$/, '').trim();
  return event ? { event, from, to } : null;
}

function findStateElementId(model: UMLModel, stateName: string | null): string | null {
  if (!stateName) return null;
  for (const [id, el] of Object.entries(model.elements)) {
    if (el.type === AGENT_STATE_TYPE && el.name === stateName) return id;
  }
  return null;
}

function findTransitionRelId(
  model: UMLModel,
  fromStateName: string | null,
  toStateName: string | null,
): string | null {
  if (!fromStateName || !toStateName) return null;
  const fromId = findStateElementId(model, fromStateName);
  const toId = findStateElementId(model, toStateName);
  if (!fromId || !toId) return null;
  for (const [id, rel] of Object.entries(model.relationships)) {
    const r = rel as UMLRelationship;
    if (
      r.type === AGENT_TRANSITION_TYPE &&
      r.source?.element === fromId &&
      r.target?.element === toId
    ) {
      return id;
    }
  }
  return null;
}

function buildHighlightedModel(model: UMLModel, activeState: string | null): UMLModel {
  if (!activeState) return model;
  const elements = { ...model.elements };
  for (const [id, el] of Object.entries(elements)) {
    if (el.type === AGENT_STATE_TYPE && el.name === activeState) {
      elements[id] = { ...el, fillColor: ACTIVE_STATE_FILL };
    }
  }
  return { ...model, elements };
}

function scrollToState(containerEl: HTMLElement, model: UMLModel, stateName: string): void {
  const activeEl = Object.values(model.elements).find(
    (e) => e.type === AGENT_STATE_TYPE && e.name === stateName,
  );
  if (!activeEl) return;

  const canvasSvg = containerEl.querySelector<Element>('#modeling-editor-canvas');
  if (!canvasSvg) return;

  let scrollEl: HTMLElement | null = canvasSvg.parentElement as HTMLElement | null;
  while (scrollEl && scrollEl !== containerEl) {
    const { overflow, overflowX, overflowY } = getComputedStyle(scrollEl);
    if (/auto|scroll/.test(overflow + overflowX + overflowY)) break;
    scrollEl = scrollEl.parentElement as HTMLElement | null;
  }
  if (!scrollEl || scrollEl === containerEl) return;

  const svgEl = canvasSvg as SVGSVGElement;
  const svgWidth = svgEl.width?.baseVal?.value || svgEl.clientWidth || 0;
  const svgHeight = svgEl.height?.baseVal?.value || svgEl.clientHeight || 0;

  const cx = svgWidth / 2 + activeEl.bounds.x + activeEl.bounds.width / 2;
  const cy = svgHeight / 2 + activeEl.bounds.y + activeEl.bounds.height / 2;

  scrollEl.scrollTo({
    left: Math.max(0, cx - scrollEl.clientWidth / 2),
    top: Math.max(0, cy - scrollEl.clientHeight / 2),
    behavior: 'smooth',
  });
}

interface AgentDiagramReadOnlyProps {
  currentState: string | null;
}

export const AgentDiagramReadOnly: React.FC<AgentDiagramReadOnlyProps> = ({ currentState }) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ApollonEditor | null>(null);
  const isReadyRef = useRef(false);
  const currentStateRef = useRef(currentState);
  currentStateRef.current = currentState;

  const diagram = useAppSelector(selectActiveDiagram);
  const stdoutLines = useAppSelector(selectStdoutLines);
  const diagramRef = useRef(diagram);
  diagramRef.current = diagram;

  // State highlight tracking
  const prevHighlightIdRef = useRef<string | null>(null);
  const originalFillsRef = useRef<Record<string, string | undefined>>({});
  const prevDiagramRef = useRef(diagram);

  // Transition highlight tracking
  const prevCurrentStateRef = useRef<string | null>(null);
  const prevHighlightRelIdRef = useRef<string | null>(null);
  const origRelStrokesRef = useRef<Record<string, string | undefined>>({});
  const styleElRef = useRef<HTMLStyleElement | null>(null);

  const [showHistory, setShowHistory] = useState(false);

  // Parse transition history from stdout
  const transitionHistory = React.useMemo<TransitionEntry[]>(() => {
    const entries: TransitionEntry[] = [];
    for (const line of stdoutLines) {
      const parsed = parseTransitionLog(line);
      if (parsed) entries.push(parsed);
    }
    return entries;
  }, [stdoutLines]);

  // Create editor on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const origModel = diagramRef.current?.model;
    const umlModel = origModel && isUMLModel(origModel) ? origModel : undefined;

    if (umlModel) {
      for (const [id, el] of Object.entries(umlModel.elements)) {
        if (el.type === AGENT_STATE_TYPE) {
          originalFillsRef.current[id] = el.fillColor;
        }
      }
      for (const [id, rel] of Object.entries(umlModel.relationships)) {
        origRelStrokesRef.current[id] = (rel as UMLRelationship).strokeColor;
      }
    }

    const initState = currentStateRef.current;
    prevHighlightIdRef.current = umlModel ? findStateElementId(umlModel, initState) : null;
    prevDiagramRef.current = diagramRef.current;

    const editor = new ApollonEditor(containerRef.current, {
      type: UMLDiagramType.AgentDiagram,
      readonly: true,
      mode: ApollonMode.Exporting,
      enablePopups: false,
      locale: Locale.en,
      model: umlModel ? buildHighlightedModel(umlModel, initState) : undefined,
    });
    editorRef.current = editor;

    void editor.nextRender.then(() => {
      if (editorRef.current !== editor) return;
      isReadyRef.current = true;

      if (initState && containerRef.current) {
        requestAnimationFrame(() => {
          if (containerRef.current && initState && editorRef.current) {
            scrollToState(containerRef.current, editorRef.current.model, initState);
          }
        });
      }
    });

    // Inject <style> element for transition stroke-width override
    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-agent-test', 'transition-highlight');
    document.head.appendChild(styleEl);
    styleElRef.current = styleEl;

    return () => {
      editorRef.current = null;
      isReadyRef.current = false;
      prevHighlightIdRef.current = null;
      originalFillsRef.current = {};
      prevHighlightRelIdRef.current = null;
      origRelStrokesRef.current = {};
      prevCurrentStateRef.current = null;
      styleElRef.current?.remove();
      styleElRef.current = null;
      setTimeout(() => {
        try { editor.destroy(); } catch {}
      }, 0);
    };
  }, []);

  // Update state + transition highlight when currentState changes
  useEffect(() => {
    if (!isReadyRef.current || !editorRef.current) return;
    const model = diagram?.model;
    if (!model || !isUMLModel(model)) return;

    const editor = editorRef.current;
    const isDiagramChange = prevDiagramRef.current !== diagram;
    prevDiagramRef.current = diagram;

    if (isDiagramChange) {
      originalFillsRef.current = {};
      for (const [id, el] of Object.entries(model.elements)) {
        if (el.type === AGENT_STATE_TYPE) {
          originalFillsRef.current[id] = el.fillColor;
        }
      }
      origRelStrokesRef.current = {};
      for (const [id, rel] of Object.entries(model.relationships)) {
        origRelStrokesRef.current[id] = (rel as UMLRelationship).strokeColor;
      }
      const newStateId = findStateElementId(model, currentState);
      prevHighlightIdRef.current = newStateId;
      const newRelId = findTransitionRelId(model, prevCurrentStateRef.current, currentState);
      prevHighlightRelIdRef.current = newRelId;
      prevCurrentStateRef.current = currentState;
      editor.model = buildHighlightedModel(model, currentState);
      return;
    }

    const patches: Patch = [];

    // --- State fill highlight ---
    const prevStateId = prevHighlightIdRef.current;
    const newStateId = findStateElementId(model, currentState);

    if (prevStateId !== newStateId) {
      if (prevStateId) {
        const orig = originalFillsRef.current[prevStateId];
        if (orig !== undefined && orig !== null) {
          patches.push({ op: 'replace', path: `/elements/${prevStateId}/fillColor`, value: orig });
        } else {
          patches.push({ op: 'remove', path: `/elements/${prevStateId}/fillColor` });
        }
      }
      if (newStateId) {
        patches.push({ op: 'add', path: `/elements/${newStateId}/fillColor`, value: ACTIVE_STATE_FILL });
      }
      prevHighlightIdRef.current = newStateId;
    }

    // --- Transition stroke highlight ---
    const prevRelId = prevHighlightRelIdRef.current;
    const newRelId = findTransitionRelId(model, prevCurrentStateRef.current, currentState);
    prevCurrentStateRef.current = currentState;

    if (prevRelId !== newRelId) {
      if (prevRelId) {
        const orig = origRelStrokesRef.current[prevRelId];
        if (orig !== undefined && orig !== null) {
          patches.push({ op: 'replace', path: `/relationships/${prevRelId}/strokeColor`, value: orig });
        } else {
          patches.push({ op: 'remove', path: `/relationships/${prevRelId}/strokeColor` });
        }
      }
      if (newRelId) {
        patches.push({ op: 'add', path: `/relationships/${newRelId}/strokeColor`, value: ACTIVE_TRANSITION_STROKE });
      }
      prevHighlightRelIdRef.current = newRelId;

      // CSS injection: glow on the active transition (doesn't scale the arrowhead)
      if (styleElRef.current) {
        styleElRef.current.textContent = newRelId
          ? `#${CSS.escape(newRelId)} g { filter: drop-shadow(0 0 4px ${ACTIVE_TRANSITION_STROKE}cc); }`
          : '';
      }
    }

    if (patches.length > 0) {
      editor.importPatch(patches);
    }

    // Smooth-scroll to new active state
    if (currentState && containerRef.current) {
      requestAnimationFrame(() => {
        if (containerRef.current && currentState && editorRef.current) {
          scrollToState(containerRef.current, editorRef.current.model, currentState);
        }
      });
    }
  }, [currentState, diagram]);

  const hasModel = diagram?.model && isUMLModel(diagram.model);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      {/* Current state label + View transitions button */}
      {(currentState || transitionHistory.length > 0) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 px-1">
          {currentState && (
            <>
              <span className="text-xs text-muted-foreground">{t('agentSimulation.diagram.currentState')}</span>
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={{
                  color: ACTIVE_STATE_FILL,
                  backgroundColor: `${ACTIVE_STATE_FILL}22`,
                  border: `1px solid ${ACTIVE_STATE_FILL}55`,
                }}
              >
                {currentState}
              </span>
            </>
          )}
          {transitionHistory.length > 0 && (
            <button
              className="ml-1 flex items-center gap-1 rounded-md border border-border/50 bg-card px-2 py-0.5 text-xs text-muted-foreground shadow-sm transition-colors hover:border-border hover:text-foreground"
              onClick={() => setShowHistory((v) => !v)}
              aria-expanded={showHistory}
            >
              {showHistory ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              {showHistory ? t('agentSimulation.diagram.hide') : t('agentSimulation.diagram.view')}{' '}
              {t('agentSimulation.diagram.transitions', { count: transitionHistory.length })}
            </button>
          )}
        </div>
      )}

      {/* Transition history panel */}
      {showHistory && transitionHistory.length > 0 && (
        <div
          className="shrink-0 overflow-y-auto rounded-lg border border-border/50 bg-card p-2 shadow-sm"
          style={{ maxHeight: '50%' }}
        >
          <div className="flex flex-wrap items-center gap-1">
            {transitionHistory.map((entry, i) => (
              <React.Fragment key={i}>
                {/* Show "from" state only for first entry */}
                {i === 0 && (
                  <span
                    className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{
                      color: ACTIVE_STATE_FILL,
                      backgroundColor: `${ACTIVE_STATE_FILL}22`,
                      border: `1px solid ${ACTIVE_STATE_FILL}55`,
                    }}
                  >
                    {entry.from}
                  </span>
                )}
                {/* Arrow + event label */}
                <div className="flex shrink-0 items-center gap-1">
                  <div className="h-px w-3 bg-border" />
                  <span className="max-w-[100px] truncate rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {entry.event}
                  </span>
                  <div className="h-px w-1 bg-border" />
                  <svg width="6" height="8" viewBox="0 0 6 8" className="text-border" fill="currentColor">
                    <path d="M0 0 L6 4 L0 8 Z" />
                  </svg>
                </div>
                {/* Destination state */}
                <span
                  className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                  style={{
                    color: entry.to === currentState ? ACTIVE_STATE_FILL : undefined,
                    backgroundColor: entry.to === currentState ? `${ACTIVE_STATE_FILL}22` : undefined,
                    border: entry.to === currentState
                      ? `1px solid ${ACTIVE_STATE_FILL}55`
                      : '1px solid hsl(var(--border))',
                  }}
                >
                  {entry.to}
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Diagram canvas */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-lg border border-border/50 shadow-sm">
        {!hasModel && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            <Bot className="size-10 text-muted-foreground/25" />
            <p className="text-sm font-medium text-muted-foreground">{t('agentSimulation.diagram.empty')}</p>
          </div>
        )}
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={{ backgroundColor: 'var(--apollon-background, #ffffff)' }}
        />
      </div>
    </div>
  );
};
