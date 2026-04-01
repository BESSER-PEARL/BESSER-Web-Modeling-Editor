import React, { useMemo } from 'react';
import { UMLDiagramType } from '@besser/wme';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { BesserProject, SupportedDiagramType } from '../../shared/types/project';
import { toSupportedDiagramType } from '../../shared/types/project';
import {
  AGENT_ROUTE_ITEMS,
  NON_UML_EDITOR_ITEMS,
  ROUTE_ITEMS,
  UML_ITEMS,
  SidebarToggleIcon,
  navButtonClass,
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

/** Wraps children with a Tooltip when sidebar is collapsed, otherwise renders children directly. */
const SidebarTooltip: React.FC<{ label: string; collapsed: boolean; children: React.ReactNode }> = ({ label, collapsed, children }) => {
  if (!collapsed) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );
};

/** Diagram count shown next to the label when more than 1 diagram exists. */
function labelWithCount(label: string, count: number): string {
  return count > 1 ? `${label} (${count})` : label;
}

const WorkspaceSidebarInner: React.FC<WorkspaceSidebarProps> = ({
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

  const isCollapsed = !isSidebarExpanded;

  return (
    <TooltipProvider delayDuration={300}>
      <aside className={`${sidebarBaseClass} animate-slide-in-left ${isSidebarExpanded ? 'w-48' : 'w-[72px]'}`}>
        {isSidebarExpanded && <p className={sidebarTitleClass}>Editors</p>}
        {UML_ITEMS.map((item) => {
          const active = locationPath === '/' && !isNonUmlActive && activeUmlType === item.type;
          const isAgentItem = item.type === UMLDiagramType.AgentDiagram;
          const count = countMap[item.type] ?? 0;
          const displayLabel = labelWithCount(item.label, count);

          if (!isAgentItem) {
            return (
              <SidebarTooltip key={item.type} label={displayLabel} collapsed={isCollapsed}>
                <button
                  type="button"
                  className={navButtonClass(active, isSidebarExpanded, isDarkTheme)}
                  onClick={() => onSwitchUml(item.type)}
                  title={isSidebarExpanded ? displayLabel : undefined}
                  aria-label={displayLabel}
                >
                  {item.icon}
                  {isSidebarExpanded && <span>{displayLabel}</span>}
                </button>
              </SidebarTooltip>
            );
          }

          return (
            <div key={item.type} className={agentContainerClass}>
              <SidebarTooltip label={displayLabel} collapsed={isCollapsed}>
                <button
                  type="button"
                  className={navButtonClass(active, isSidebarExpanded, isDarkTheme)}
                  onClick={() => onSwitchUml(item.type)}
                  title={isSidebarExpanded ? displayLabel : undefined}
                  aria-label={displayLabel}
                >
                  {item.icon}
                  {isSidebarExpanded && <span>{displayLabel}</span>}
                </button>
              </SidebarTooltip>
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  showAgentSubItems ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                {AGENT_ROUTE_ITEMS.map((routeItem) => {
                  const isActiveSubItem = locationPath === routeItem.path;
                  return (
                    <SidebarTooltip key={routeItem.path} label={routeItem.label} collapsed={isCollapsed}>
                      <button
                        type="button"
                        className={`${navButtonClass(isActiveSubItem, isSidebarExpanded, isDarkTheme)} ${
                          isSidebarExpanded ? 'mt-1 pl-7 text-xs' : 'mt-1'
                        }`}
                        onClick={() => onNavigate(routeItem.path)}
                        title={isSidebarExpanded ? routeItem.label : undefined}
                        aria-label={routeItem.label}
                      >
                        {routeItem.icon}
                        {isSidebarExpanded && <span>{routeItem.label}</span>}
                      </button>
                    </SidebarTooltip>
                  );
                })}
              </div>
            </div>
          );
        })}

        {NON_UML_EDITOR_ITEMS.map((item) => {
          const active = locationPath === '/' && activeDiagramType === item.type;
          const count = countMap[item.type] ?? 0;
          const displayLabel = labelWithCount(item.label, count);

          return (
            <SidebarTooltip key={item.type} label={displayLabel} collapsed={isCollapsed}>
              <button
                type="button"
                className={navButtonClass(active, isSidebarExpanded, isDarkTheme)}
                onClick={() => onSwitchDiagramType(item.type)}
                title={isSidebarExpanded ? displayLabel : undefined}
                aria-label={displayLabel}
              >
                {item.icon}
                {isSidebarExpanded && <span>{displayLabel}</span>}
              </button>
            </SidebarTooltip>
          );
        })}

        <Separator className="my-1" />

        {ROUTE_ITEMS.map((item) => {
          const active = locationPath === item.path;
          return (
            <SidebarTooltip key={item.path} label={item.label} collapsed={isCollapsed}>
              <button
                type="button"
                className={navButtonClass(active, isSidebarExpanded, isDarkTheme)}
                onClick={() => onNavigate(item.path)}
                title={isSidebarExpanded ? item.label : undefined}
                aria-label={item.label}
              >
                {item.icon}
                {isSidebarExpanded && <span>{item.label}</span>}
              </button>
            </SidebarTooltip>
          );
        })}

        <SidebarTooltip label={isSidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'} collapsed={isCollapsed}>
          <button
            type="button"
            onClick={onToggleExpanded}
            className={`${sidebarToggleClass} ${isSidebarExpanded ? 'justify-between gap-2' : 'justify-center'}`}
            aria-label={isSidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <span className={`inline-flex transition-transform ${isSidebarExpanded ? '' : 'rotate-180'}`}>
              <SidebarToggleIcon size={18} />
            </span>
            {isSidebarExpanded && <span className={sidebarToggleTextClass}></span>}
          </button>
        </SidebarTooltip>
      </aside>
    </TooltipProvider>
  );
};

export const WorkspaceSidebar = React.memo(WorkspaceSidebarInner);
