import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { UMLDiagramType } from '@besser/wme';
import { FlaskConical } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { PerspectiveSettings, SupportedDiagramType } from '../../shared/types/project';
import { isPerspectiveVisible, toSupportedDiagramType } from '../../shared/types/project';
import {
  AGENT_ROUTE_ITEMS,
  NON_UML_EDITOR_ITEMS,
  ROUTE_ITEMS,
  UML_ITEMS,
  SidebarToggleIcon,
  navButtonClass,
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
  /** Number of diagrams per type (only counts above 1 are shown). */
  diagramCounts: Partial<Record<SupportedDiagramType, number>>;
  perspectives: PerspectiveSettings | undefined;
  onSwitchUml: (type: UMLDiagramType) => void;
  onSwitchDiagramType: (type: SupportedDiagramType) => void;
  onNavigate: (path: string) => void;
  /** Omit to hide the collapse toggle (e.g. inside the mobile drawer). */
  onToggleExpanded?: () => void;
  onTestAgent?: () => void;
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

/** Expanded-sidebar label, with the diagram count as a right-aligned number. */
const NavLabel: React.FC<{ label: string; count?: number }> = ({ label, count = 0 }) => (
  <>
    <span className="min-w-0 truncate">{label}</span>
    {count > 1 && (
      <span className="ml-auto pl-2 text-[11px] font-normal tabular-nums text-muted-foreground" aria-hidden="true">
        {count}
      </span>
    )}
  </>
);

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
  diagramCounts,
  perspectives,
  onSwitchUml,
  onSwitchDiagramType,
  onNavigate,
  onToggleExpanded,
  onTestAgent,
}) => {
  const { t } = useTranslation();
  // When a non-UML editor (GUI / Quantum) is active, no UML button should appear selected
  const isNonUmlActive = activeDiagramType === 'GUINoCodeDiagram' || activeDiagramType === 'QuantumCircuitDiagram';
  const isAgentEditorActive = locationPath === '/' && !isNonUmlActive && activeUmlType === UMLDiagramType.AgentDiagram;
  const isAgentSubRouteActive = AGENT_ROUTE_ITEMS.some((item) => item.path === locationPath) || locationPath === '/agent-simulation';
  const showAgentSubItems = isAgentEditorActive || isAgentSubRouteActive;
  const agentContainerClass = showAgentSubItems
    ? isDarkTheme
      ? 'rounded-xl bg-white/[0.03] p-1'
      : 'rounded-xl bg-foreground/[0.03] p-1'
    : '';

  // Pre-compute diagram count info for all diagram types
  const countMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of UML_ITEMS) {
      map[item.type] = diagramCounts[toSupportedDiagramType(item.type)] ?? 0;
    }
    for (const item of NON_UML_EDITOR_ITEMS) {
      map[item.type] = diagramCounts[item.type] ?? 0;
    }
    return map;
  }, [diagramCounts]);

  // Filter the static perspective lists by the per-project `perspectives` setting.
  // Hidden perspectives are removed from the sidebar entirely; their data is preserved.
  const visibleUmlItems = useMemo(
    () => UML_ITEMS.filter((it) => isPerspectiveVisible(perspectives, toSupportedDiagramType(it.type))),
    [perspectives],
  );
  const visibleNonUmlItems = useMemo(
    () => NON_UML_EDITOR_ITEMS.filter((it) => isPerspectiveVisible(perspectives, it.type)),
    [perspectives],
  );

  const isCollapsed = !isSidebarExpanded;

  return (
    <TooltipProvider delayDuration={300}>
      <aside className={`${sidebarBaseClass} ${isSidebarExpanded ? 'w-48' : 'w-[72px]'}`}>
        {isSidebarExpanded && <p className={sidebarTitleClass}>{t('nav.editors')}</p>}
        <nav aria-label={t('nav.editors')} className="flex flex-col gap-0.5">
        {visibleUmlItems.map((item) => {
          const active = locationPath === '/' && !isNonUmlActive && activeUmlType === item.type;
          const isAgentItem = item.type === UMLDiagramType.AgentDiagram;
          const count = countMap[item.type] ?? 0;
          const displayLabel = labelWithCount(t(item.labelKey), count);

          if (!isAgentItem) {
            return (
              <SidebarTooltip key={item.type} label={displayLabel} collapsed={isCollapsed}>
                <button
                  type="button"
                  className={navButtonClass(active, isSidebarExpanded, isDarkTheme)}
                  onClick={() => onSwitchUml(item.type)}
                  title={isSidebarExpanded ? displayLabel : undefined}
                  aria-label={displayLabel}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.icon}
                  {isSidebarExpanded && <NavLabel label={t(item.labelKey)} count={count} />}
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
                  aria-current={active ? 'page' : undefined}
                >
                  {item.icon}
                  {isSidebarExpanded && <NavLabel label={t(item.labelKey)} count={count} />}
                </button>
              </SidebarTooltip>
              {showAgentSubItems && (
              <div className="duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] animate-in fade-in-0 slide-in-from-top-1">
                {onTestAgent && (
                  <SidebarTooltip label={t('agentSimulation.sidebar.simulateAgent')} collapsed={isCollapsed}>
                    <button
                      type="button"
                      className={`${navButtonClass(locationPath === '/agent-simulation', isSidebarExpanded, isDarkTheme)} ${
                        isSidebarExpanded ? 'mt-1 pl-7 text-xs' : 'mt-1'
                      }`}
                      onClick={onTestAgent}
                      title={isSidebarExpanded ? t('agentSimulation.sidebar.simulateAgent') : undefined}
                      aria-label={t('agentSimulation.sidebar.simulateAgent')}
                      aria-current={locationPath === '/agent-simulation' ? 'page' : undefined}
                    >
                      <FlaskConical className="size-4" />
                      {isSidebarExpanded && <span>{t('agentSimulation.sidebar.simulateAgent')}</span>}
                    </button>
                  </SidebarTooltip>
                )}
                {AGENT_ROUTE_ITEMS.map((routeItem) => {
                  const isActiveSubItem = locationPath === routeItem.path;
                  const routeLabel = t(routeItem.labelKey);
                  return (
                    <SidebarTooltip key={routeItem.path} label={routeLabel} collapsed={isCollapsed}>
                      <button
                        type="button"
                        className={`${navButtonClass(isActiveSubItem, isSidebarExpanded, isDarkTheme)} ${
                          isSidebarExpanded ? 'mt-1 pl-7 text-xs' : 'mt-1'
                        }`}
                        onClick={() => onNavigate(routeItem.path)}
                        title={isSidebarExpanded ? routeLabel : undefined}
                        aria-label={routeLabel}
                        aria-current={isActiveSubItem ? 'page' : undefined}
                      >
                        {routeItem.icon}
                        {isSidebarExpanded && <span>{routeLabel}</span>}
                      </button>
                    </SidebarTooltip>
                  );
                })}
              </div>
              )}
            </div>
          );
        })}

        {visibleNonUmlItems.map((item) => {
          const active = locationPath === '/' && activeDiagramType === item.type;
          const count = countMap[item.type] ?? 0;
          const displayLabel = labelWithCount(t(item.labelKey), count);

          return (
            <SidebarTooltip key={item.type} label={displayLabel} collapsed={isCollapsed}>
              <button
                type="button"
                className={navButtonClass(active, isSidebarExpanded, isDarkTheme)}
                onClick={() => onSwitchDiagramType(item.type)}
                title={isSidebarExpanded ? displayLabel : undefined}
                aria-label={displayLabel}
                aria-current={active ? 'page' : undefined}
              >
                {item.icon}
                {isSidebarExpanded && <NavLabel label={t(item.labelKey)} count={count} />}
              </button>
            </SidebarTooltip>
          );
        })}

        <Separator className="my-1" />

        {ROUTE_ITEMS.map((item) => {
          const active = locationPath === item.path;
          const routeLabel = t(item.labelKey);
          return (
            <SidebarTooltip key={item.path} label={routeLabel} collapsed={isCollapsed}>
              <button
                type="button"
                className={navButtonClass(active, isSidebarExpanded, isDarkTheme)}
                onClick={() => onNavigate(item.path)}
                title={isSidebarExpanded ? routeLabel : undefined}
                aria-label={routeLabel}
                aria-current={active ? 'page' : undefined}
              >
                {item.icon}
                {isSidebarExpanded && <span>{routeLabel}</span>}
              </button>
            </SidebarTooltip>
          );
        })}
        </nav>

        {onToggleExpanded && (
        <SidebarTooltip label={isSidebarExpanded ? t('nav.collapseSidebar') : t('nav.expandSidebar')} collapsed={isCollapsed}>
          <button
            type="button"
            onClick={onToggleExpanded}
            className={`${sidebarToggleClass} ${isSidebarExpanded ? 'justify-start gap-2.5' : 'justify-center'}`}
            aria-label={isSidebarExpanded ? t('nav.collapseSidebar') : t('nav.expandSidebar')}
          >
            <span className="inline-flex">
              <SidebarToggleIcon expanded={isSidebarExpanded} size={18} />
            </span>
            {isSidebarExpanded && <span className={sidebarToggleTextClass}>{t('nav.collapseSidebar')}</span>}
          </button>
        </SidebarTooltip>
        )}
      </aside>
    </TooltipProvider>
  );
};

export const WorkspaceSidebar = React.memo(WorkspaceSidebarInner);
