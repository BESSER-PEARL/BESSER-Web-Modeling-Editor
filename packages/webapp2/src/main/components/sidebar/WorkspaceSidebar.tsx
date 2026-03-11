import React, { useMemo } from 'react';
import { UMLDiagramType } from '@besser/wme';
import { Link2 } from 'lucide-react';
import type { BesserProject, SupportedDiagramType } from '../../types/project';
import { toSupportedDiagramType } from '../../types/project';
import {
  AGENT_ROUTE_ITEMS,
  NON_UML_EDITOR_ITEMS,
  ROUTE_ITEMS,
  UML_ITEMS,
  SidebarToggleIcon,
  navButtonClass,
  DIAGRAM_GENERATOR_MAP,
  diagramCount,
} from './workspace-navigation';

interface WorkspaceSidebarProps {
  isDarkTheme: boolean;
  isSidebarExpanded: boolean;
  sidebarBaseClass: string;
  sidebarTitleClass: string;
  sidebarDividerClass: string;
  sidebarToggleClass: string;
  sidebarToggleTextClass: string;
  locationPath: string;
  activeUmlType: UMLDiagramType;
  activeDiagramType: SupportedDiagramType;
  project: BesserProject | null;
  onSwitchUml: (type: UMLDiagramType) => void;
  onSwitchDiagramType: (type: SupportedDiagramType) => void;
  onNavigate: (path: string) => void;
  onToggleExpanded: () => void;
}

/** Generator count badge shown when sidebar is expanded. */
const GenBadge: React.FC<{ info: { generators: string[]; label: string }; isStateMachine: boolean; isDark: boolean }> = ({
  info,
  isStateMachine,
  isDark,
}) => {
  if (isStateMachine) {
    return (
      <span
        className="ml-auto flex items-center gap-0.5 text-[10px] leading-none text-muted-foreground/70"
        title={info.label}
      >
        <Link2 className="h-2.5 w-2.5" />
      </span>
    );
  }

  const count = info.generators.length;
  if (count === 0) return null;

  return (
    <span
      className="ml-auto text-[10px] leading-none text-muted-foreground/70"
      title={info.label}
    >
      {count} gen.
    </span>
  );
};

/** Diagram count shown next to the label when more than 1 diagram exists. */
function labelWithCount(label: string, count: number): string {
  return count > 1 ? `${label} (${count})` : label;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  isDarkTheme,
  isSidebarExpanded,
  sidebarBaseClass,
  sidebarTitleClass,
  sidebarDividerClass,
  sidebarToggleClass,
  sidebarToggleTextClass,
  locationPath,
  activeUmlType,
  activeDiagramType,
  project,
  onSwitchUml,
  onSwitchDiagramType,
  onNavigate,
  onToggleExpanded,
}) => {
  // When a non-UML editor (GUI / Quantum) is active, no UML button should appear selected
  const isNonUmlActive = activeDiagramType === 'GUINoCodeDiagram' || activeDiagramType === 'QuantumCircuitDiagram';
  const isAgentEditorActive = locationPath === '/' && !isNonUmlActive && activeUmlType === UMLDiagramType.AgentDiagram;
  const isAgentSubRouteActive = AGENT_ROUTE_ITEMS.some((item) => item.path === locationPath);
  const showAgentSubItems = isAgentEditorActive || isAgentSubRouteActive;
  const agentContainerClass = showAgentSubItems
    ? isDarkTheme
      ? 'rounded-xl border border-sky-500/30 bg-sky-500/10 p-1'
      : 'rounded-xl border border-primary/30 bg-primary/10 p-1'
    : '';

  // Pre-compute diagram count info for all diagram types
  const countMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of UML_ITEMS) {
      const supported = toSupportedDiagramType(item.type);
      map[item.type] = diagramCount(project, supported);
    }
    for (const item of NON_UML_EDITOR_ITEMS) {
      map[item.type] = diagramCount(project, item.type);
    }
    return map;
  }, [project]);

  return (
    <aside className={`${sidebarBaseClass} ${isSidebarExpanded ? 'w-48' : 'w-[72px]'}`}>
      {isSidebarExpanded && <p className={sidebarTitleClass}>Editors</p>}
      {UML_ITEMS.map((item) => {
        const active = locationPath === '/' && !isNonUmlActive && activeUmlType === item.type;
        const isAgentItem = item.type === UMLDiagramType.AgentDiagram;
        const supported = toSupportedDiagramType(item.type);
        const count = countMap[item.type] ?? 0;
        const genInfo = DIAGRAM_GENERATOR_MAP[supported];
        const isStateMachine = item.type === UMLDiagramType.StateMachineDiagram;
        const displayLabel = labelWithCount(item.label, count);

        if (!isAgentItem) {
          return (
            <button
              key={item.type}
              type="button"
              className={navButtonClass(active, isSidebarExpanded, isDarkTheme)}
              onClick={() => onSwitchUml(item.type)}
              title={`${displayLabel} — ${genInfo.label}`}
            >
              {item.icon}
              {isSidebarExpanded ? (
                <>
                  <span>{displayLabel}</span>
                  <GenBadge info={genInfo} isStateMachine={isStateMachine} isDark={isDarkTheme} />
                </>
              ) : null}
            </button>
          );
        }

        return (
          <div key={item.type} className={agentContainerClass}>
            <button
              type="button"
              className={navButtonClass(active, isSidebarExpanded, isDarkTheme)}
              onClick={() => onSwitchUml(item.type)}
              title={`${displayLabel} — ${genInfo.label}`}
            >
              {item.icon}
              {isSidebarExpanded ? (
                <>
                  <span>{displayLabel}</span>
                  <GenBadge info={genInfo} isStateMachine={false} isDark={isDarkTheme} />
                </>
              ) : null}
            </button>
            <div
              className={`overflow-hidden transition-all duration-200 ${
                showAgentSubItems ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              {AGENT_ROUTE_ITEMS.map((routeItem) => {
                const isActiveSubItem = locationPath === routeItem.path;
                return (
                  <button
                    key={routeItem.path}
                    type="button"
                    className={`${navButtonClass(isActiveSubItem, isSidebarExpanded, isDarkTheme)} ${
                      isSidebarExpanded ? 'mt-1 pl-7 text-xs' : 'mt-1'
                    }`}
                    onClick={() => onNavigate(routeItem.path)}
                    title={routeItem.label}
                  >
                    {routeItem.icon}
                    {isSidebarExpanded && <span>{routeItem.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {NON_UML_EDITOR_ITEMS.map((item) => {
        const active = locationPath === '/' && activeDiagramType === item.type;
        const count = countMap[item.type] ?? 0;
        const genInfo = DIAGRAM_GENERATOR_MAP[item.type];
        const displayLabel = labelWithCount(item.label, count);

        return (
          <button
            key={item.type}
            type="button"
            className={navButtonClass(active, isSidebarExpanded, isDarkTheme)}
            onClick={() => onSwitchDiagramType(item.type)}
            title={`${displayLabel} — ${genInfo.label}`}
          >
            {item.icon}
            {isSidebarExpanded ? (
              <>
                <span>{displayLabel}</span>
                <GenBadge info={genInfo} isStateMachine={false} isDark={isDarkTheme} />
              </>
            ) : null}
          </button>
        );
      })}

      <div className={sidebarDividerClass} />

      {ROUTE_ITEMS.map((item) => {
        const active = locationPath === item.path;
        return (
          <button
            key={item.path}
            type="button"
            className={navButtonClass(active, isSidebarExpanded, isDarkTheme)}
            onClick={() => onNavigate(item.path)}
            title={item.label}
          >
            {item.icon}
            {isSidebarExpanded && <span>{item.label}</span>}
          </button>
        );
      })}

      <button
        type="button"
        onClick={onToggleExpanded}
        className={`${sidebarToggleClass} ${isSidebarExpanded ? 'justify-between gap-2' : 'justify-center'}`}
        title={isSidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        aria-label={isSidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        <span className="inline-flex rotate-180">
          <SidebarToggleIcon size={18} />
        </span>
        {isSidebarExpanded && <span className={sidebarToggleTextClass}></span>}
      </button>
    </aside>
  );
};
