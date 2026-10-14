import React from 'react';
import { useTranslation } from 'react-i18next';
import { SectionHeader, TextField } from '../runtimeFields';
import type { ConfigSectionProps } from './types';

export function AgentConfigSection({ runtime: { form, setAgent } }: ConfigSectionProps) {
  const { t } = useTranslation();
  return (
    <>
      <SectionHeader title={t('agentConfig.yamlEditor.section.agent')} description={t('agentConfig.runtime.section.agent.desc')} />
      <TextField
        id="cfg-agent-ctd"
        label="check_transitions_delay"
        value={form.agent.check_transitions_delay}
        onChange={v => setAgent({ check_transitions_delay: v })}
        description={t('agentConfig.runtime.field.agent.checkTransitionsDelayDesc')}
      />
    </>
  );
}
