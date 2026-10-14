import React from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import type { AgentRuntimeConfig } from '../../../../shared/services/storage/local-storage-repository';
import type { IntentRecognitionTechnology } from '../../../../shared/types/agent-config';
import { OptionSelect, SectionHeader } from '../runtimeFields';

const SELECT_CLASS = 'h-9 transition-colors hover:border-brand/30';

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
            <OptionSelect
              id="arp-platform"
              className={SELECT_CLASS}
              value={agentRuntimeConfig.agentPlatform}
              onValueChange={v => updateAgentRuntimeConfig({
                agentPlatform: v,
                agentPlatformUseStreamlit: v !== 'websocket' ? false : agentRuntimeConfig.agentPlatformUseStreamlit,
              })}
              options={[
                { value: 'websocket', label: t('agentConfig.runtime.platformWebSocket') },
                { value: 'telegram', label: t('agentConfig.runtime.platformTelegram') },
              ]}
            />
            {agentRuntimeConfig.agentPlatform === 'websocket' && (
              <label className="flex items-center gap-2 text-sm cursor-pointer pt-1">
                <Checkbox
                  checked={agentRuntimeConfig.agentPlatformUseStreamlit ?? false}
                  onCheckedChange={checked => updateAgentRuntimeConfig({ agentPlatformUseStreamlit: checked })}
                />
                {t('agentConfig.runtime.useStreamlitUi')}
              </label>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="arp-intent">{t('agentConfig.runtime.intent')}</Label>
            <OptionSelect
              id="arp-intent"
              className={SELECT_CLASS}
              value={agentRuntimeConfig.intentRecognitionTechnology}
              onValueChange={v => updateAgentRuntimeConfig({
                intentRecognitionTechnology: v as IntentRecognitionTechnology,
              })}
              options={[
                { value: 'classical', label: t('agentConfig.runtime.intentClassical') },
                { value: 'llm-based', label: t('agentConfig.runtime.intentLlmBased') },
              ]}
            />
          </div>

          {agentRuntimeConfig.intentRecognitionTechnology === 'llm-based' && (
            <div className="space-y-1.5">
              <Label htmlFor="arp-llm">{t('agentConfig.runtime.llm')}</Label>
              <OptionSelect
                id="arp-llm"
                className={SELECT_CLASS}
                value={agentRuntimeConfig.agentLlmName}
                onValueChange={v => updateAgentRuntimeConfig({ agentLlmName: v })}
                options={[
                  { value: '', label: t('agentConfig.runtime.useDefault') },
                  ...agentLLMElements.map(entry => ({
                    value: entry.name,
                    label: entry.name || t('agentConfig.row.unnamedLlm'),
                  })),
                ]}
              />
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
