import React from 'react';
import { useTranslation } from 'react-i18next';
import { AgentComponentType } from '@besser/wme';
import { ItemRow } from '../ui/ItemRow';
import { CheckboxField, JsonField, NumberField, SelectField, TextField } from '../ui/fields';
import { EmptyHint, SectionPage } from '../ui/SectionPage';
import type { SectionProps } from './types';

const LLM_PROVIDERS: { value: string; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'huggingface', label: 'HuggingFace (local)' },
  { value: 'huggingface_api', label: 'HuggingFace API' },
  { value: 'replicate', label: 'Replicate' },
  { value: 'ollama', label: 'Ollama (local)' },
];

export function LlmsSection({ store, expandedId, toggle, expand }: SectionProps) {
  const { t } = useTranslation();
  const { llms, defaultLlmName, updateComponent, removeComponent, setDefaultLlm } = store;

  return (
    <SectionPage
      title={t('agentComponents.llms.title')}
      description={t('agentComponents.llms.description')}
      onAdd={() => expand(store.addComponent(AgentComponentType.AgentLLM))}
      addLabel={t('agentComponents.llms.addLabel')}
    >
      {llms.length === 0 && <EmptyHint message={t('agentComponents.llms.empty')} />}
      {llms.map((el) => (
        <ItemRow
          key={el.id}
          name={el.name}
          badge={el.provider}
          extraBadge={defaultLlmName === el.name && el.name ? t('agentConfig.row.default') : undefined}
          expanded={expandedId === el.id}
          onToggle={() => toggle(el.id)}
          onDelete={() => removeComponent(el.id)}
        >
          <div className="grid grid-cols-2 gap-4">
            <TextField
              id={`llm-name-${el.id}`}
              label={t('agentComponents.llms.modelName')}
              value={el.name || ''}
              onChange={v => updateComponent(el.id, { name: v })}
              placeholder={t('agentComponents.llms.modelNamePlaceholder')}
              description={t('agentComponents.llms.modelNameDescription')}
            />
            <SelectField
              id={`llm-provider-${el.id}`}
              label={t('agentComponents.llms.provider')}
              value={el.provider || 'openai'}
              onChange={v => updateComponent(el.id, { provider: v })}
              options={LLM_PROVIDERS}
            />
          </div>
          <CheckboxField
            id={`llm-default-${el.id}`}
            label={t('agentComponents.llms.setDefault')}
            value={!!el.name && defaultLlmName === el.name}
            onChange={(checked) => {
              if (checked && el.name) setDefaultLlm(el.name);
              else if (!checked && defaultLlmName === el.name) setDefaultLlm('');
            }}
            description={t('agentComponents.llms.setDefaultDescription')}
          />
          <NumberField
            id={`llm-npm-${el.id}`}
            label={t('agentComponents.llms.numPrevMessages')}
            value={el.num_previous_messages ?? 1}
            onChange={v => updateComponent(el.id, { num_previous_messages: Math.max(0, v) })}
            min={0}
          />
          <JsonField
            id={`llm-params-${el.id}`}
            label={t('agentComponents.llms.parameters')}
            description={t('agentComponents.llms.parametersDescription')}
            value={(el.parameters || {}) as Record<string, unknown>}
            onChange={v => updateComponent(el.id, { parameters: v })}
          />
          <TextField
            id={`llm-ctx-${el.id}`}
            label={t('agentComponents.llms.globalContext')}
            value={el.global_context || ''}
            onChange={v => updateComponent(el.id, { global_context: v })}
            placeholder={t('agentComponents.llms.globalContextPlaceholder')}
            multiline
          />
        </ItemRow>
      ))}
    </SectionPage>
  );
}
