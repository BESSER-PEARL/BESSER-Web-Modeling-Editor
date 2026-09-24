import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Toggle } from './runtimeFields';
import type { AgentRuntimeForm } from './useAgentRuntimeForm';

export type RuntimeSection =
  | 'runtime'
  | 'config-agent'
  | 'config-nlp'
  | 'config-platform-websocket'
  | 'config-platform-telegram'
  | 'config-platform-github'
  | 'config-platform-gitlab'
  | 'config-platform-a2a'
  | 'config-database'
  | 'config-custom'
  | 'config-raw';

const NAV_ITEM_CLASS = 'text-sm transition-colors';
const navItemState = (active: boolean) =>
  active
    ? 'bg-accent text-accent-foreground font-medium'
    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground';

/** Section navigation of the agent runtime panel, with enable toggles for each platform. */
export function RuntimeSidebar({ activeSection, onSelect, runtime }: {
  activeSection: RuntimeSection;
  onSelect: (section: RuntimeSection) => void;
  runtime: AgentRuntimeForm;
}) {
  const { t } = useTranslation();
  const { form } = runtime;

  const platformItems: Array<{ key: RuntimeSection; label: string; enabled: boolean; onToggle: (v: boolean) => void }> = [
    { key: 'config-platform-websocket', label: t('agentConfig.runtime.section.websocket.title'), enabled: form.platforms.websocket.enabled, onToggle: v => runtime.setWs({ enabled: v }) },
    { key: 'config-platform-telegram', label: t('agentConfig.runtime.section.telegram.title'), enabled: form.platforms.telegram.enabled, onToggle: v => runtime.setTelegram({ enabled: v }) },
    { key: 'config-platform-github', label: t('agentConfig.runtime.section.github.title'), enabled: form.platforms.github.enabled, onToggle: v => runtime.setGithub({ enabled: v }) },
    { key: 'config-platform-gitlab', label: t('agentConfig.runtime.section.gitlab.title'), enabled: form.platforms.gitlab.enabled, onToggle: v => runtime.setGitlab({ enabled: v }) },
    { key: 'config-platform-a2a', label: t('agentConfig.runtime.section.a2a.title'), enabled: form.platforms.a2a.enabled, onToggle: v => runtime.setA2a({ enabled: v }) },
  ];

  const navBtn = (key: RuntimeSection, label: string) => (
    <button
      key={key}
      type="button"
      onClick={() => onSelect(key)}
      className={cn('flex w-full items-center px-4 py-2', NAV_ITEM_CLASS, navItemState(activeSection === key))}
    >
      {label}
    </button>
  );

  return (
    <nav className="w-56 shrink-0 border-r border-border py-3">
      <p className="px-4 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t('agentConfig.runtime.sidebarSettings')}
      </p>

      {navBtn('runtime', t('agentConfig.runtime.title'))}

      <div className="mt-4">
        <p className="px-4 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t('agentConfig.runtime.sidebarConfigFile')}
        </p>

        {navBtn('config-agent', t('agentConfig.yamlEditor.section.agent'))}
        {navBtn('config-nlp', t('agentConfig.yamlEditor.section.nlp'))}

        <p className="px-4 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
          {t('agentConfig.runtime.sidebarPlatforms')}
        </p>

        {platformItems.map(p => (
          <div key={p.key} className="flex items-center">
            <button
              type="button"
              onClick={() => onSelect(p.key)}
              className={cn('flex flex-1 items-center py-2 pl-8 pr-2', NAV_ITEM_CLASS, navItemState(activeSection === p.key))}
            >
              {p.label}
            </button>
            <div className="pr-3 shrink-0">
              <Toggle value={p.enabled} onChange={p.onToggle} />
            </div>
          </div>
        ))}

        {navBtn('config-database', t('agentConfig.runtime.section.database.title'))}
        {navBtn('config-custom', t('agentConfig.runtime.section.custom.title'))}
        {navBtn('config-raw', t('agentConfig.yamlEditor.tab.raw'))}
      </div>
    </nav>
  );
}
