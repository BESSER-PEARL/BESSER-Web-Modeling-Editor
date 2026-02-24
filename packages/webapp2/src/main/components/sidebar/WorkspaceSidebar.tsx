import React from 'react';
import { UMLDiagramType } from '@besser/wme';
import { AGENT_ROUTE_ITEMS, ROUTE_ITEMS, UML_ITEMS, SidebarToggleIcon, navButtonClass } from './workspace-navigation';

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
  onSwitchUml: (type: UMLDiagramType) => void;
  onNavigate: (path: string) => void;
  onToggleExpanded: () => void;
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
  onSwitchUml,
  onNavigate,
  onToggleExpanded,
}) => {
  const isAgentEditorActive = locationPath === '/' && activeUmlType === UMLDiagramType.AgentDiagram;
  const isAgentSubRouteActive = AGENT_ROUTE_ITEMS.some((item) => item.path === locationPath);
  const showAgentSubItems = isAgentEditorActive || isAgentSubRouteActive;
  const agentContainerClass = showAgentSubItems
    ? isDarkTheme
      ? 'rounded-xl border border-sky-500/30 bg-sky-500/10 p-1'
      : 'rounded-xl border border-primary/30 bg-primary/10 p-1'
    : '';

  return (
    <aside className={`${sidebarBaseClass} ${isSidebarExpanded ? 'w-48' : 'w-[72px]'}`}>
      {isSidebarExpanded && <p className={sidebarTitleClass}>Editors</p>}
      {UML_ITEMS.map((item) => {
        const active = locationPath === '/' && activeUmlType === item.type;
        const isAgentItem = item.type === UMLDiagramType.AgentDiagram;

        if (!isAgentItem) {
          return (
            <button
              key={item.type}
              type="button"
              className={navButtonClass(active, isSidebarExpanded, isDarkTheme)}
              onClick={() => onSwitchUml(item.type)}
              title={item.label}
            >
              {item.icon}
              {isSidebarExpanded && <span>{item.label}</span>}
            </button>
          );
        }

        return (
          <div key={item.type} className={agentContainerClass}>
            <button
              type="button"
              className={navButtonClass(active, isSidebarExpanded, isDarkTheme)}
              onClick={() => onSwitchUml(item.type)}
              title={item.label}
            >
              {item.icon}
              {isSidebarExpanded && <span>{item.label}</span>}
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
      >
        <span className="inline-flex rotate-180">
          <SidebarToggleIcon size={18} />
        </span>
        {isSidebarExpanded && <span className={sidebarToggleTextClass}></span>}
      </button>
    </aside>
  );
};
