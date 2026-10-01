import React from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { Label } from '@/components/ui/label';
import type { AgentRuntimeConfig } from '../../../../shared/services/storage/local-storage-repository';
import type { IntentRecognitionTechnology } from '../../../../shared/types/agent-config';
import { SectionHeader } from '../runtimeFields';

const SELECT_CLASS =
  'h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:border-brand/30 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20';

export interface RuntimeSettingsSectionProps {
  agentRuntimeConfig: AgentRuntimeConfig;
  updateAgentRuntimeConfig: (updates: Partial<AgentRuntimeConfig>) => void;
  agentLLMElements: Array<{ id: string; name: string }>;
}

/** Platform, intent recognition and intent-recognition LLM of the agent runtime. */
export function RuntimeSettingsSection({ agentRuntimeConfig, updateAgentRuntimeConfig, agentLLMElements }: RuntimeSettingsSectionProps) {
  const { t } = useTranslation();
  return (
    <>
      <SectionHeader
        title={t('agentConfig.runtime.title')}
        description={t('agentConfig.runtime.section.runtime.desc')}
      />
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="arp-platform">{t('agentConfig.runtime.platform')}</Label>
            <select
              id="arp-platform"
              className={SELECT_CLASS}
              value={agentRuntimeConfig.agentPlatform}
              onChange={e => updateAgentRuntimeConfig({
                agentPlatform: e.target.value,
                agentPlatformUseStreamlit: e.target.value !== 'websocket' ? false : agentRuntimeConfig.agentPlatformUseStreamlit,
              })}
            >
              <option value="websocket">{t('agentConfig.runtime.platformWebSocket')}</option>
              <option value="telegram">{t('agentConfig.runtime.platformTelegram')}</option>
            </select>
            {agentRuntimeConfig.agentPlatform === 'websocket' && (
              <label className="flex items-center gap-2 text-sm cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={agentRuntimeConfig.agentPlatformUseStreamlit ?? false}
                  onChange={e => updateAgentRuntimeConfig({ agentPlatformUseStreamlit: e.target.checked })}
                />
                {t('agentConfig.runtime.useStreamlitUi')}
              </label>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="arp-intent">{t('agentConfig.runtime.intent')}</Label>
            <select
              id="arp-intent"
              className={SELECT_CLASS}
              value={agentRuntimeConfig.intentRecognitionTechnology}
              onChange={e => updateAgentRuntimeConfig({
                intentRecognitionTechnology: e.target.value as IntentRecognitionTechnology,
              })}
            >
              <option value="classical">{t('agentConfig.runtime.intentClassical')}</option>
              <option value="llm-based">{t('agentConfig.runtime.intentLlmBased')}</option>
            </select>
          </div>

          {agentRuntimeConfig.intentRecognitionTechnology === 'llm-based' && (
            <div className="space-y-1.5">
              <Label htmlFor="arp-llm">{t('agentConfig.runtime.llm')}</Label>
              <select
                id="arp-llm"
                className={SELECT_CLASS}
                value={agentRuntimeConfig.agentLlmName}
                onChange={e => updateAgentRuntimeConfig({ agentLlmName: e.target.value })}
              >
                <option value="">{t('agentConfig.runtime.useDefault')}</option>
                {agentLLMElements.map(entry => (
                  <option key={entry.id} value={entry.name}>
                    {entry.name || t('agentConfig.row.unnamedLlm')}
                  </option>
                ))}
              </select>
              {agentLLMElements.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  <Trans i18nKey="agentConfig.runtime.defineLlmsHint" components={{ strong: <strong /> }} />
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
