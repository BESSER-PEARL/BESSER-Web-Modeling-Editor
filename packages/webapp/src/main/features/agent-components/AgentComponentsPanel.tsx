import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Cpu, Database, FolderOpen, Layout, MessageSquare, Server, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

import { useAgentComponentsStore } from './hooks/useAgentComponentsStore';
import { LlmsSection } from './sections/LlmsSection';
import { IntentsSection } from './sections/IntentsSection';
import { ToolsSection } from './sections/ToolsSection';
import { SkillsSection } from './sections/SkillsSection';
import { WorkspacesSection } from './sections/WorkspacesSection';
import { RagsSection } from './sections/RagsSection';
import { SqlDatabasesSection } from './sections/SqlDatabasesSection';
import { GuisSection } from './sections/GuisSection';
import type { SectionProps } from './sections/types';

type ActiveSection = 'llms' | 'intents' | 'tools' | 'skills' | 'workspaces' | 'rags' | 'sql' | 'guis';

/**
 * The agent Components page: a section sidebar and the active section. Components are read
 * from and written to the active AgentDiagram's `model.components` (see useAgentComponentsStore).
 */
export function AgentComponentsPanel() {
  const { t } = useTranslation();
  const store = useAgentComponentsStore();
  const [activeSection, setActiveSection] = useState<ActiveSection>('llms');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [openEditorGuiId, setOpenEditorGuiId] = useState<string | null>(null);

  if (!store.activeDiagram) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t('agentComponents.noActiveDiagram')}
      </div>
    );
  }

  const navItems: Array<{ key: ActiveSection; label: string; icon: React.ReactNode; count: number }> = [
    { key: 'llms',       label: t('agentComponents.nav.llms'),         icon: <Cpu className="h-4 w-4" />,           count: store.llms.length },
    { key: 'intents',    label: t('agentComponents.nav.intents'),      icon: <MessageSquare className="h-4 w-4" />, count: store.intents.length },
    { key: 'tools',      label: t('agentComponents.nav.tools'),        icon: <Wrench className="h-4 w-4" />,        count: store.tools.length },
    { key: 'skills',     label: t('agentComponents.nav.skills'),       icon: <BookOpen className="h-4 w-4" />,      count: store.skills.length },
    { key: 'workspaces', label: t('agentComponents.nav.workspaces'),   icon: <FolderOpen className="h-4 w-4" />,    count: store.workspaces.length },
    { key: 'rags',       label: t('agentComponents.nav.ragDatabases'), icon: <Database className="h-4 w-4" />,      count: store.rags.length },
    { key: 'sql',        label: t('agentComponents.nav.sqlDatabases'), icon: <Server className="h-4 w-4" />,        count: store.sqlDatabases.length },
    { key: 'guis',       label: t('agentComponents.nav.guis'),         icon: <Layout className="h-4 w-4" />,        count: store.guis.length },
  ];

  const sectionProps: SectionProps = {
    store,
    expandedId,
    toggle: (id) => setExpandedId((prev) => (prev === id ? null : id)),
    expand: setExpandedId,
  };

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left sidebar ──────────────────────────────────────── */}
      <nav className="w-52 shrink-0 border-r border-border overflow-y-auto py-3">
        <p className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t('agentComponents.sidebarTitle')}
        </p>
        {navItems.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => { setActiveSection(item.key); setExpandedId(null); }}
            className={cn(
              'flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-colors',
              activeSection === item.key
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
          >
            <span className="shrink-0">{item.icon}</span>
            <span className="flex-1 text-left">{item.label}</span>
            {item.count > 0 && (
              <Badge
                variant={activeSection === item.key ? 'default' : 'secondary'}
                className="text-[10px] h-4 px-1.5"
              >
                {item.count}
              </Badge>
            )}
          </button>
        ))}
      </nav>

      {/* ── Main content ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className={cn('px-8 py-6', openEditorGuiId ? 'w-full' : 'max-w-2xl')}>
          {activeSection === 'llms' && <LlmsSection {...sectionProps} />}
          {activeSection === 'intents' && <IntentsSection {...sectionProps} />}
          {activeSection === 'tools' && <ToolsSection {...sectionProps} />}
          {activeSection === 'skills' && <SkillsSection {...sectionProps} />}
          {activeSection === 'workspaces' && <WorkspacesSection {...sectionProps} />}
          {activeSection === 'rags' && <RagsSection {...sectionProps} />}
          {activeSection === 'guis' && (
            <GuisSection {...sectionProps} openEditorGuiId={openEditorGuiId} setOpenEditorGuiId={setOpenEditorGuiId} />
          )}
          {activeSection === 'sql' && <SqlDatabasesSection {...sectionProps} />}
        </div>
      </div>
    </div>
  );
}
