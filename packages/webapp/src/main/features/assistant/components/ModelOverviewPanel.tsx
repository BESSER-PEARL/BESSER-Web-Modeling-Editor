/**
 * ModelOverviewPanel — the "app blueprint" recap inside the agentic drawer.
 *
 * A structured, readable summary of what the agent has built so far, without
 * leaving the conversation: the data model (classes, attributes, enums), the
 * relationships, the GUI screens (page names + their sections) and any OCL
 * constraints. Everything is derived live from the project store on each
 * render — no extra state, always in sync with the canvas.
 */

import React, { useMemo } from 'react';
import { Boxes, Database, GitBranch, MonitorSmartphone, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useProject } from '../../../app/hooks/useProject';

/* ------------------------------------------------------------------ */
/*  Model parsing                                                      */
/* ------------------------------------------------------------------ */

interface ClassInfo {
  name: string;
  kind: 'class' | 'enum' | 'interface' | 'abstract';
  attributes: { name: string; type: string }[];
  methods: string[];
}

interface RelationInfo {
  source: string;
  target: string;
  label: string;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
}

interface ScreenInfo {
  name: string;
  sections: string[];
}

const REL_LABELS: Record<string, string> = {
  ClassBidirectional: 'association',
  ClassUnidirectional: 'association',
  ClassInheritance: 'inheritance',
  ClassComposition: 'composition',
  ClassAggregation: 'aggregation',
  ClassRealization: 'realization',
  ClassDependency: 'dependency',
};

function activeDiagramModel(project: any, type: string): any {
  const list = project?.diagrams?.[type];
  if (!Array.isArray(list) || list.length === 0) return undefined;
  const idx = project?.currentDiagramIndices?.[type] ?? 0;
  return (list[idx] ?? list[0])?.model;
}

function parseClassDiagram(model: any): { classes: ClassInfo[]; relations: RelationInfo[]; constraints: string[] } {
  const elements: Record<string, any> = model?.elements ?? {};
  const classes: ClassInfo[] = [];
  const constraints: string[] = [];

  for (const el of Object.values(elements)) {
    if (!el || typeof el !== 'object') continue;
    if (el.type === 'ClassOCLConstraint' && el.constraint) {
      constraints.push(String(el.constraint));
      continue;
    }
    if (!['Class', 'AbstractClass', 'Interface', 'Enumeration'].includes(el.type)) continue;
    const attributes = (el.attributes ?? [])
      .map((id: string) => elements[id])
      .filter(Boolean)
      .map((a: any) => ({ name: a.name ?? '', type: a.attributeType ?? '' }));
    const methods = (el.methods ?? [])
      .map((id: string) => elements[id]?.name)
      .filter(Boolean);
    classes.push({
      name: el.name ?? 'Unnamed',
      kind: el.type === 'Enumeration' ? 'enum'
        : el.type === 'Interface' ? 'interface'
          : el.type === 'AbstractClass' ? 'abstract' : 'class',
      attributes,
      methods,
    });
  }

  const relations: RelationInfo[] = [];
  for (const rel of Object.values((model?.relationships ?? {}) as Record<string, any>)) {
    if (!rel || typeof rel !== 'object') continue;
    const source = elements[rel.source?.element]?.name;
    const target = elements[rel.target?.element]?.name;
    if (!source || !target) continue;
    relations.push({
      source,
      target,
      label: REL_LABELS[rel.type] ?? 'association',
      sourceMultiplicity: rel.source?.multiplicity || undefined,
      targetMultiplicity: rel.target?.multiplicity || undefined,
    });
  }

  return { classes, relations, constraints };
}

function collectHeadings(node: any, out: string[]): void {
  if (!node || typeof node !== 'object' || out.length >= 6) return;
  if (
    ['h1', 'h2', 'h3'].includes(node.tagName)
    && typeof node.content === 'string'
    && node.content.trim()
  ) {
    out.push(node.content.trim());
  }
  for (const child of node.components ?? []) collectHeadings(child, out);
}

function parseScreens(model: any): ScreenInfo[] {
  const pages = Array.isArray(model?.pages) ? model.pages : [];
  return pages
    .filter((p: any) => p && typeof p === 'object')
    .map((page: any) => {
      const sections: string[] = [];
      collectHeadings(page.frames?.[0]?.component, sections);
      return { name: page.name ?? 'Page', sections };
    });
}

/* ------------------------------------------------------------------ */
/*  Presentation                                                       */
/* ------------------------------------------------------------------ */

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; count: number }> = ({ icon, title, count }) => (
  <div className="mb-2 flex items-center gap-2">
    <span className="flex size-6 items-center justify-center rounded-md bg-brand/10 text-brand ring-1 ring-brand/15">
      {icon}
    </span>
    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground/80">{title}</span>
    <span className="ml-auto rounded-full bg-muted/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{count}</span>
  </div>
);

export const ModelOverviewPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { currentProject } = useProject();

  const { classes, relations, constraints, screens } = useMemo(() => {
    const classModel = activeDiagramModel(currentProject, 'ClassDiagram');
    const guiModel = activeDiagramModel(currentProject, 'GUINoCodeDiagram');
    const parsed = parseClassDiagram(classModel);
    return { ...parsed, screens: parseScreens(guiModel) };
  }, [currentProject]);

  const empty = classes.length === 0 && screens.length === 0;

  return (
    <div className="absolute inset-y-0 right-0 z-20 flex w-[380px] max-w-[92vw] flex-col border-l border-border/50 bg-background/97 shadow-[-8px_0_24px_-12px_rgba(0,0,0,0.18)] backdrop-blur-md animate-in slide-in-from-right-4 fade-in-0 duration-200">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <Boxes className="size-4 text-brand" />
          <span className="text-sm font-semibold tracking-tight">Your model</span>
        </div>
        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" onClick={onClose} aria-label="Close model overview">
          <X className="size-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {empty && (
          <p className="rounded-lg border border-dashed border-border/60 bg-muted/15 px-3 py-6 text-center text-xs text-muted-foreground">
            Nothing modeled yet — ask the assistant to create a system and the
            blueprint will appear here.
          </p>
        )}

        {/* Data model */}
        {classes.length > 0 && (
          <section>
            <SectionHeader icon={<Database className="size-3.5" />} title="Data model" count={classes.length} />
            <div className="space-y-2">
              {classes.map((cls) => (
                <div key={cls.name} className="rounded-lg border border-border/50 bg-card/60 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold tracking-tight">{cls.name}</span>
                    {cls.kind !== 'class' && (
                      <span className="rounded-full bg-brand/10 px-1.5 py-px font-mono text-[9px] text-brand">
                        {cls.kind}
                      </span>
                    )}
                  </div>
                  {cls.kind === 'enum' ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {cls.attributes.map((a) => (
                        <span key={a.name} className="rounded-full border border-border/50 bg-muted/30 px-1.5 py-px font-mono text-[10px] text-muted-foreground">
                          {a.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <>
                      {cls.attributes.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5">
                          {cls.attributes.map((a) => (
                            <li key={a.name} className="flex items-baseline justify-between gap-2 text-[11px]">
                              <span className="truncate text-foreground/85">{a.name}</span>
                              <span className="shrink-0 font-mono text-[10px] text-muted-foreground/80">{a.type}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {cls.methods.length > 0 && (
                        <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground/60">
                          {cls.methods.join(' · ')}
                        </p>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Relationships */}
        {relations.length > 0 && (
          <section>
            <SectionHeader icon={<GitBranch className="size-3.5" />} title="Relationships" count={relations.length} />
            <ul className="space-y-1">
              {relations.map((rel, i) => (
                <li key={i} className="flex items-center gap-1.5 rounded-md border border-border/40 bg-card/40 px-2.5 py-1.5 text-[11px]">
                  <span className="font-medium">{rel.source}</span>
                  {rel.sourceMultiplicity && <span className="font-mono text-[9px] text-muted-foreground">{rel.sourceMultiplicity}</span>}
                  <span className="text-muted-foreground/70">—{rel.label}→</span>
                  {rel.targetMultiplicity && <span className="font-mono text-[9px] text-muted-foreground">{rel.targetMultiplicity}</span>}
                  <span className="font-medium">{rel.target}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Screens */}
        {screens.length > 0 && (
          <section>
            <SectionHeader icon={<MonitorSmartphone className="size-3.5" />} title="Screens" count={screens.length} />
            <div className="space-y-2">
              {screens.map((screen) => (
                <div key={screen.name} className="rounded-lg border border-border/50 bg-card/60 px-3 py-2">
                  <span className="text-xs font-semibold tracking-tight">{screen.name}</span>
                  {screen.sections.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {screen.sections.map((s, i) => (
                        <li key={i} className="truncate text-[11px] text-muted-foreground">• {s}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Constraints */}
        {constraints.length > 0 && (
          <section>
            <SectionHeader icon={<ShieldCheck className="size-3.5" />} title="Constraints" count={constraints.length} />
            <ul className="space-y-1">
              {constraints.map((c, i) => (
                <li key={i} className="rounded-md border border-border/40 bg-muted/20 px-2.5 py-1.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
                  {c}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
};
