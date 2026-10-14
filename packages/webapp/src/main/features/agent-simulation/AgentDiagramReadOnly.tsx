import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BesserEditor, BesserMode, UMLDiagramType, type UMLModel } from '@besser/wme';
import { Bot, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppSelector } from '@/main/app/store/hooks';
import { selectActiveDiagram } from '@/main/app/store/workspaceSlice';
import { selectStdoutLines } from '@/main/features/agent-simulation';
import { isUMLModel } from '@/main/shared/types/project';
import { toEditorLocale } from '@/main/shared/i18n/languages';

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
  const beforeArrow = line.slice(0, arrowMatch.index!).trimEnd().replace(/:?\s*$/, '').trimEnd();
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

const nodeName = (node: UMLModel['nodes'][number]): unknown => (node.data as { name?: unknown } | undefined)?.name;

/** Id of the AgentState node (v4 `nodes`) named `stateName`. */
export function findStateNodeId(model: UMLModel, stateName: string | null): string | null {
  if (!stateName) return null;
  const node = (model.nodes ?? []).find((n) => (n.type as string) === AGENT_STATE_TYPE && nodeName(n) === stateName);
  return node?.id ?? null;
}

/** Id of the AgentStateTransition edge (v4 `edges`) between two named states. */
export function findTransitionEdgeId(
  model: UMLModel,
  fromStateName: string | null,
  toStateName: string | null,
): string | null {
  if (!fromStateName || !toStateName) return null;
  const fromId = findStateNodeId(model, fromStateName);
  const toId = findStateNodeId(model, toStateName);
  if (!fromId || !toId) return null;
  const edge = (model.edges ?? []).find(
    (e) => (e.type as string) === AGENT_TRANSITION_TYPE && e.source === fromId && e.target === toId,
  );
  return edge?.id ?? null;
}

/**
 * The model with the active state filled and the last-taken transition stroked. Pure: the
 * stored model is never mutated, so the original colours come back when the highlight moves.
 */
export function buildHighlightedModel(
  model: UMLModel,
  activeState: string | null,
  activeTransitionId: string | null = null,
): UMLModel {
  if (!activeState && !activeTransitionId) return model;
  return {
    ...model,
    nodes: (model.nodes ?? []).map((node) =>
      activeState && (node.type as string) === AGENT_STATE_TYPE && nodeName(node) === activeState
        ? { ...node, data: { ...node.data, fillColor: ACTIVE_STATE_FILL } }
        : node,
    ),
    edges: (model.edges ?? []).map((edge) =>
      activeTransitionId && edge.id === activeTransitionId
        ? { ...edge, data: { ...edge.data, strokeColor: ACTIVE_TRANSITION_STROKE } }
        : edge,
    ),
  };
}

interface AgentDiagramReadOnlyProps {
  currentState: string | null;
}

export const AgentDiagramReadOnly: React.FC<AgentDiagramReadOnlyProps> = ({ currentState }) => {
  const { t, i18n } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<BesserEditor | null>(null);
  const isReadyRef = useRef(false);
  const currentStateRef = useRef(currentState);
  currentStateRef.current = currentState;

  const diagram = useAppSelector(selectActiveDiagram);
  const stdoutLines = useAppSelector(selectStdoutLines);
  const diagramRef = useRef(diagram);
  diagramRef.current = diagram;

  // Transition highlight tracking: the transition taken to reach the current state.
  const prevCurrentStateRef = useRef<string | null>(null);
  const activeTransitionIdRef = useRef<string | null>(null);
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

  // Create a read-only React Flow editor on mount (readonly hides the palette; no popups).
  useEffect(() => {
    if (!containerRef.current) return;

    const origModel = diagramRef.current?.model;
    const umlModel = origModel && isUMLModel(origModel) ? origModel : undefined;
    const initState = currentStateRef.current;
    prevCurrentStateRef.current = initState;

    const editor = new BesserEditor(containerRef.current, {
      type: UMLDiagramType.AgentDiagram,
      readonly: true,
      mode: BesserMode.Exporting,
      enablePopups: false,
      locale: toEditorLocale(i18n.language),
      model: umlModel ? buildHighlightedModel(umlModel, initState) : undefined,
    });
    editorRef.current = editor;

    void editor.ready.then(() => {
      if (editorRef.current !== editor) return;
      isReadyRef.current = true;
      // Bring the initial state into view, as develop's scrollToState did.
      const stateId = umlModel && initState ? findStateNodeId(umlModel, initState) : null;
      if (stateId) editor.fitToElements([stateId]);
    });

    // Injected <style> element: glow on the active transition (doesn't scale the arrowhead)
    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-agent-test', 'transition-highlight');
    document.head.appendChild(styleEl);
    styleElRef.current = styleEl;

    return () => {
      editorRef.current = null;
      isReadyRef.current = false;
      activeTransitionIdRef.current = null;
      prevCurrentStateRef.current = null;
      styleElRef.current?.remove();
      styleElRef.current = null;
      setTimeout(() => {
        try {
          editor.destroy();
        } catch {
          /* already destroyed */
        }
      }, 0);
    };
    // The editor is created once; model / highlight changes are pushed by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update state + transition highlight when the current state (or the diagram) changes.
  useEffect(() => {
    if (!isReadyRef.current || !editorRef.current) return;
    const model = diagram?.model;
    if (!model || !isUMLModel(model)) return;

    if (prevCurrentStateRef.current !== currentState) {
      activeTransitionIdRef.current = findTransitionEdgeId(model, prevCurrentStateRef.current, currentState);
      prevCurrentStateRef.current = currentState;
    }
    const activeTransitionId = activeTransitionIdRef.current;
    editorRef.current.model = buildHighlightedModel(model, currentState, activeTransitionId);
    const stateId = findStateNodeId(model, currentState);
    if (stateId) editorRef.current.fitToElements([stateId]);

    if (styleElRef.current) {
      styleElRef.current.textContent = activeTransitionId
        ? `.react-flow__edge[data-id="${CSS.escape(activeTransitionId)}"] { filter: drop-shadow(0 0 4px ${ACTIVE_TRANSITION_STROKE}cc); }`
        : '';
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
          style={{ backgroundColor: 'var(--besser-background, #ffffff)' }}
        />
      </div>
    </div>
  );
};
