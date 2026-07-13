import React from 'react';
import { Loader2, Route } from 'lucide-react';
import type { SmartGenPreviewPlan, SmartGenPrimaryKind } from '../types';

const LABELS: Record<SmartGenPrimaryKind, string> = {
  class: 'Class model',
  gui: 'GUI model',
  agent: 'Agent model',
  state_machine: 'State machine',
  object: 'Object model',
  quantum: 'Quantum circuit',
  bpmn: 'BPMN process',
  nn: 'Neural network',
};

interface Props {
  status: 'idle' | 'loading' | 'ready' | 'error';
  plan: SmartGenPreviewPlan | null;
  error: string | null;
  instructions: string;
}

export function SmartGenPreviewPanel(props: Props) {
  return props.status === 'ready' && props.plan
    ? <ReadyPlan plan={props.plan} instructions={props.instructions} />
    : <PreviewState status={props.status} error={props.error} />;
}

function PreviewState(props: Props) {
  const text = props.status === 'loading'
    ? 'Analysing models and selecting the generator...'
    : props.status === 'error'
      ? props.error || 'Could not prepare the plan.'
      : 'Limits changed. Review the updated plan before running.';
  return (
    <section aria-live="polite" className="flex min-h-32 items-center justify-center gap-3 rounded-xl border border-brand/20 bg-brand/[0.035] p-4 text-sm text-muted-foreground">
      {props.status === 'loading' && <Loader2 className="size-4 animate-spin text-brand" />}
      {text}
    </section>
  );
}

function ReadyPlan(props: { plan: SmartGenPreviewPlan; instructions: string }) {
  const plan = props.plan;
  const generator = plan.executionMode === 'modify'
    ? 'Existing generated workspace'
    : plan.targetGenerator
      ? plan.targetGenerator.replace(/^generate_/, '').replaceAll('_', ' ')
      : 'LLM from scratch';
  const execution = plan.executionMode === 'modify'
    ? 'Modify previous run'
    : 'Fresh build';
  const minutes = Math.floor(plan.estimatedDurationSeconds / 60);
  const seconds = Math.round(plan.estimatedDurationSeconds % 60);
  const duration = minutes ? `${minutes}m${seconds ? ` ${seconds}s` : ''}` : `${seconds}s`;
  return (
    <section aria-live="polite" className="overflow-hidden rounded-xl border border-brand/20 bg-brand/[0.035]">
      <header className="flex items-center justify-between border-b border-brand/15 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold"><Route className="size-4 text-brand" /> Proposed execution plan</span>
        <span className="rounded-full bg-brand/10 px-2 py-1 text-[10px] font-semibold uppercase text-brand">Preview · free</span>
      </header>
      <div className="space-y-3 p-4">
        <p className="text-sm font-medium">{plan.summary}</p>
        <p className="max-h-16 overflow-y-auto rounded-md border bg-background/70 p-2 text-xs text-muted-foreground">“{props.instructions}”</p>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="rounded-full bg-brand/10 px-2 py-1 font-semibold text-brand">Primary · {LABELS[plan.primaryKind]}</span>
          {plan.auxiliaryKinds.map((kind) => <span key={kind} className="rounded-full bg-muted px-2 py-1">+ {LABELS[kind]}</span>)}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Fact label="Execution" value={execution} />
          <Fact label={plan.executionMode === 'modify' ? 'Starting point' : 'Deterministic base'} value={generator} />
          <Fact label="Estimated cost" value={`$${plan.estimatedCostUsd.toFixed(2)}`} />
          <Fact label="Duration" value={duration} />
          <Fact label="LLM turns" value={String(plan.estimatedTurns)} />
        </div>
        {plan.notes.length > 0 && <ul className="space-y-1 border-t pt-3 text-xs text-muted-foreground">{plan.notes.map((note) => <li key={note}>• {note}</li>)}</ul>}
      </div>
    </section>
  );
}

function Fact(props: { label: string; value: string }) {
  return <div className="rounded-lg border bg-background/75 p-2"><p className="text-[10px] uppercase text-muted-foreground">{props.label}</p><p className="mt-1 text-xs font-semibold capitalize">{props.value}</p></div>;
}
