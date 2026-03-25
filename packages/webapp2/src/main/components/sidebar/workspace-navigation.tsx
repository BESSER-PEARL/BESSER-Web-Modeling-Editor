import React from 'react';
import { UMLDiagramType } from '@besser/wme';
import { Atom, Bot, Layers3, Network, PackageOpen, Repeat2, Settings, SlidersHorizontal } from 'lucide-react';
import { SHOW_AGENT_PERSONALIZATION_BUTTON } from '../../constants/constant';
import type { SupportedDiagramType, BesserProject, ProjectDiagram } from '../../types/project';
import { diagramHasContent } from '../../types/project';

/** Maps each diagram type to its available generators and a human-readable label. */
export const DIAGRAM_GENERATOR_MAP: Record<SupportedDiagramType, { generators: string[]; label: string }> = {
  ClassDiagram: {
    generators: ['django', 'backend', 'web_app', 'python', 'java', 'pydantic', 'sql', 'sqlalchemy', 'jsonschema'],
    label: '9 generators',
  },
  ObjectDiagram: {
    generators: ['jsonobject'],
    label: '1 generator',
  },
  StateMachineDiagram: {
    generators: [],
    label: 'Used in Class methods',
  },
  AgentDiagram: {
    generators: ['agent'],
    label: '1 generator',
  },
  GUINoCodeDiagram: {
    generators: ['web_app'],
    label: '1 generator',
  },
  QuantumCircuitDiagram: {
    generators: ['qiskit'],
    label: '1 generator',
  },
};

// Re-export for backwards compatibility
export { diagramHasContent } from '../../types/project';

/** For a given diagram type, check whether *any* diagram in the array has content. */
export function diagramTypeHasContent(project: BesserProject | null, type: SupportedDiagramType): boolean {
  if (!project) return false;
  const diagrams = project.diagrams[type];
  if (!diagrams || diagrams.length === 0) return false;
  return diagrams.some(diagramHasContent);
}

/** Return the number of diagrams for a given type. */
export function diagramCount(project: BesserProject | null, type: SupportedDiagramType): number {
  if (!project) return 0;
  return project.diagrams[type]?.length ?? 0;
}

export const UML_ITEMS: Array<{ type: UMLDiagramType; label: string; icon: React.ReactNode }> = [
  { type: UMLDiagramType.ClassDiagram, label: 'Class', icon: <Network className="size-4" /> },
  { type: UMLDiagramType.ObjectDiagram, label: 'Object', icon: <Layers3 className="size-4" /> },
  { type: UMLDiagramType.StateMachineDiagram, label: 'State', icon: <Repeat2 className="size-4" /> },
  { type: UMLDiagramType.AgentDiagram, label: 'Agent', icon: <Bot className="size-4" /> },
];

export const NON_UML_EDITOR_ITEMS: Array<{ type: SupportedDiagramType; label: string; icon: React.ReactNode }> = [
  { type: 'GUINoCodeDiagram', label: 'GUI', icon: <PackageOpen className="size-4" /> },
  { type: 'QuantumCircuitDiagram', label: 'Quantum', icon: <Atom className="size-4" /> },
];

const personalizationRouteItems = SHOW_AGENT_PERSONALIZATION_BUTTON
  ? [
    { path: '/agent-personalization', label: 'Agent Personalization', icon: <SlidersHorizontal className="size-4" /> },
    { path: '/agent-personalization-2', label: 'Agent Mappings', icon: <SlidersHorizontal className="size-4" /> },
  ]
  : [];

export const AGENT_ROUTE_ITEMS = [
  { path: '/agent-config', label: 'Agent Config', icon: <SlidersHorizontal className="size-4" /> },
  ...personalizationRouteItems,
] as const;

export const ROUTE_ITEMS = [{ path: '/project-settings', label: 'Settings', icon: <Settings className="size-4" /> }] as const;

export function navButtonClass(isActive: boolean, expanded: boolean, isDark: boolean) {
  return [
    `group flex w-auto items-center rounded-lg border px-2.5 py-2 text-left text-sm transition-all duration-200 md:w-full ${
      expanded ? 'justify-start gap-2' : 'justify-center'
    }`,
    isActive
      ? isDark
        ? 'border-brand/40 bg-brand/20 text-brand shadow-sm'
        : 'border-brand/30 bg-brand/10 text-brand-dark shadow-sm'
      : 'border-transparent text-muted-foreground hover:border-border/50 hover:bg-accent hover:text-foreground hover:shadow-sm active:scale-[0.97]',
  ].join(' ');
}

export const SidebarToggleIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path
      fillRule="evenodd"
      d="M11.28 9.53L8.81 12l2.47 2.47a.75.75 0 11-1.06 1.06l-3-3a.75.75 0 010-1.06l3-3a.75.75 0 111.06 1.06z"
    />
    <path
      fillRule="evenodd"
      d="M3.75 2A1.75 1.75 0 002 3.75v16.5c0 .966.784 1.75 1.75 1.75h16.5A1.75 1.75 0 0022 20.25V3.75A1.75 1.75 0 0020.25 2H3.75zM3.5 3.75a.25.25 0 01.25-.25H15v17H3.75a.25.25 0 01-.25-.25V3.75zm13 16.75v-17h3.75a.25.25 0 01.25.25v16.5a.25.25 0 01-.25.25H16.5z"
    />
  </svg>
);
