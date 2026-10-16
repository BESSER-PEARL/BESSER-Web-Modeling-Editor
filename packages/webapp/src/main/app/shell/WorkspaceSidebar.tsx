import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { UMLDiagramType } from '@besser/wme';
import { FlaskConical, Star } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { PerspectiveSettings, SupportedDiagramType } from '../../shared/types/project';
import { isPerspectiveVisible, toSupportedDiagramType } from '../../shared/types/project';
import {
  AGENT_ROUTE_ITEMS,
  KG_ROUTE_ITEMS,
  NON_UML_EDITOR_ITEMS,
  ROUTE_ITEMS,
  UML_ITEMS,
  SidebarToggleIcon,
  navButtonClass,
} from './workspace-navigation';

const GITHUB_REPO_URL = 'https://github.com/BESSER-PEARL/BESSER';

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

/** A nested link under a diagram button (agent simulation, agent settings, KG
 *  settings): indented and smaller while the sidebar is open. */
const SidebarSubItem: React.FC<{
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  isCollapsed: boolean;
  isSidebarExpanded: boolean;
  isDarkTheme: boolean;
}> = ({ label, icon, active, onClick, isCollapsed, isSidebarExpanded, isDarkTheme }) => (
  <SidebarTooltip label={label} collapsed={isCollapsed}>
    <button
      type="button"
      className={`${navButtonClass(active, isSidebarExpanded, isDarkTheme)} ${
        isSidebarExpanded ? 'mt-1 pl-7 text-xs' : 'mt-1'
      }`}
      onClick={onClick}
      title={isSidebarExpanded ? label : undefined}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
    >
      {icon}
      {isSidebarExpanded && <span>{label}</span>}
    </button>
  </SidebarTooltip>
);

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
  // When a non-UML editor (GUI / Quantum / KG) is active, no UML button should appear selected
  const isNonUmlActive =
    activeDiagramType === 'GUINoCodeDiagram' ||
    activeDiagramType === 'QuantumCircuitDiagram' ||
    activeDiagramType === 'KnowledgeGraphDiagram';
  const isAgentEditorActive = locationPath === '/' && !isNonUmlActive && activeUmlType === UMLDiagramType.AgentDiagram;
  const isAgentSubRouteActive = AGENT_ROUTE_ITEMS.some((item) => item.path === locationPath) || locationPath === '/agent-simulation';
  const showAgentSubItems = isAgentEditorActive || isAgentSubRouteActive;
  const agentContainerClass = showAgentSubItems ? 'rounded-xl bg-foreground/[0.03] p-1 dark:bg-white/[0.03]' : '';

  const isKgEditorActive = locationPath === '/' && activeDiagramType === 'KnowledgeGraphDiagram';
  const isKgSubRouteActive = KG_ROUTE_ITEMS.some((item) => item.path === locationPath);
  const showKgSubItems = isKgEditorActive || isKgSubRouteActive;
  const kgContainerClass = showKgSubItems
    ? isDarkTheme
      ? 'rounded-xl border border-sky-500/30 bg-sky-500/10 p-1'
      : 'rounded-xl border border-primary/30 bg-primary/10 p-1'
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
  const subItemProps = { isCollapsed, isSidebarExpanded, isDarkTheme };

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
                  <SidebarSubItem
                    label={t('agentSimulation.sidebar.simulateAgent')}
                    icon={<FlaskConical className="size-4" />}
                    active={locationPath === '/agent-simulation'}
                    onClick={onTestAgent}
                    {...subItemProps}
                  />
                )}
                {AGENT_ROUTE_ITEMS.map((routeItem) => (
                  <SidebarSubItem
                    key={routeItem.path}
                    label={t(routeItem.labelKey)}
                    icon={routeItem.icon}
                    active={locationPath === routeItem.path}
                    onClick={() => onNavigate(routeItem.path)}
                    {...subItemProps}
                  />
                ))}
              </div>
              )}
            </div>
          );
        })}

        {visibleNonUmlItems.map((item) => {
          const active = locationPath === '/' && activeDiagramType === item.type;
          const count = countMap[item.type] ?? 0;
          const displayLabel = labelWithCount(t(item.labelKey), count);
          const isKgItem = item.type === 'KnowledgeGraphDiagram';

          if (!isKgItem) {
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
          }

          // KG item: wrap in the shared sub-item container and render
          // KG_ROUTE_ITEMS underneath — mirrors the Agent treatment.
          return (
            <div key={item.type} className={kgContainerClass}>
              <SidebarTooltip label={displayLabel} collapsed={isCollapsed}>
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
              {showKgSubItems && (
                <div className="duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] animate-in fade-in-0 slide-in-from-top-1">
                  {KG_ROUTE_ITEMS.map((routeItem) => (
                    <SidebarSubItem
                      key={routeItem.path}
                      label={t(routeItem.labelKey)}
                      icon={routeItem.icon}
                      active={locationPath === routeItem.path}
                      onClick={() => onNavigate(routeItem.path)}
                      {...subItemProps}
                    />
                  ))}
                </div>
              )}
            </div>
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

        <SidebarTooltip label={t('nav.starOnGitHub')} collapsed={isCollapsed}>
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={navButtonClass(false, isSidebarExpanded, isDarkTheme)}
            aria-label={t('nav.starOnGitHub')}
          >
            <Star className="size-4 shrink-0 transition-colors duration-150 group-hover:fill-amber-400 group-hover:text-amber-500" />
            {isSidebarExpanded && <span className="min-w-0 truncate">{t('nav.starOnGitHub')}</span>}
          </a>
        </SidebarTooltip>
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
