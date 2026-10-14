import React from 'react';
import { useTranslation } from 'react-i18next';
import { AgentComponentType } from '@besser/wme';
import { ItemRow } from '../ui/ItemRow';
import { NumberField, SelectField, TextField } from '../ui/fields';
import { EmptyHint, SectionPage } from '../ui/SectionPage';
import type { SectionProps } from './types';

const OLLAMA_DEFAULT_URL = 'http://localhost:11434';

export function RagsSection({ store, expandedId, toggle, expand }: SectionProps) {
  const { t } = useTranslation();
  const { rags, llmNames, updateComponent, removeComponent } = store;

  return (
    <SectionPage
      title={t('agentComponents.rags.title')}
      description={t('agentComponents.rags.description')}
      onAdd={() => expand(store.addComponent(AgentComponentType.AgentRagElement))}
      addLabel={t('agentComponents.rags.addLabel')}
    >
      {rags.length === 0 && <EmptyHint message={t('agentComponents.rags.empty')} />}
      {rags.map((el) => (
        <ItemRow
          key={el.id}
          name={el.name}
          badge={el.embedding_provider}
          expanded={expandedId === el.id}
          onToggle={() => toggle(el.id)}
          onDelete={() => removeComponent(el.id)}
        >
          <div className="grid grid-cols-2 gap-4">
            <TextField
              id={`rag-name-${el.id}`}
              label={t('agentComponents.rags.name')}
              value={el.name || ''}
              onChange={v => updateComponent(el.id, { name: v })}
              placeholder={t('agentComponents.rags.namePlaceholder')}
            />
            <SelectField
              id={`rag-llm-${el.id}`}
              label={t('agentComponents.rags.llm')}
              value={el.llm_name || ''}
              onChange={v => updateComponent(el.id, { llm_name: v })}
              options={[
                { value: '', label: t('agentComponents.rags.llmUseDefault') },
                ...llmNames.map(n => ({ value: n, label: n })),
              ]}
              description={t('agentComponents.rags.llmDescription')}
            />
          </div>
          <TextField
            id={`rag-prompt-${el.id}`}
            label={t('agentComponents.rags.promptPrefix')}
            value={el.llm_prompt || ''}
            onChange={v => updateComponent(el.id, { llm_prompt: v })}
            placeholder={t('agentComponents.rags.promptPrefixPlaceholder')}
            multiline
          />
          <div className="grid grid-cols-2 gap-4">
            <NumberField
              id={`rag-k-${el.id}`}
              label={t('agentComponents.rags.kChunks')}
              value={el.k ?? 4}
              onChange={v => updateComponent(el.id, { k: Math.max(1, v) })}
              min={1}
              description={t('agentComponents.rags.kChunksDescription')}
            />
            <NumberField
              id={`rag-npm-${el.id}`}
              label={t('agentComponents.rags.numPrevMessages')}
              value={el.num_previous_messages ?? 0}
              onChange={v => updateComponent(el.id, { num_previous_messages: Math.max(0, v) })}
              min={0}
            />
          </div>
          <SelectField
            id={`rag-emb-${el.id}`}
            label={t('agentComponents.rags.embeddingProvider')}
            value={el.embedding_provider || 'openai'}
            onChange={v => {
              const updates: Record<string, unknown> = { embedding_provider: v };
              if (v === 'ollama' && !el.embedding_base_url) updates.embedding_base_url = OLLAMA_DEFAULT_URL;
              updateComponent(el.id, updates);
            }}
            options={[
              { value: 'openai', label: t('agentComponents.rags.embeddingOpenai') },
              { value: 'ollama', label: t('agentComponents.rags.embeddingOllama') },
            ]}
          />
          {el.embedding_provider === 'ollama' && (
            <div className="grid grid-cols-2 gap-4">
              <TextField
                id={`rag-emb-url-${el.id}`}
                label={t('agentComponents.rags.embeddingBaseUrl')}
                value={el.embedding_base_url || OLLAMA_DEFAULT_URL}
                onChange={v => updateComponent(el.id, { embedding_base_url: v })}
                placeholder={t('agentComponents.rags.embeddingBaseUrlPlaceholder')}
              />
              <TextField
                id={`rag-emb-model-${el.id}`}
                label={t('agentComponents.rags.embeddingModel')}
                value={el.embedding_model || ''}
                onChange={v => updateComponent(el.id, { embedding_model: v })}
                placeholder={t('agentComponents.rags.embeddingModelPlaceholder')}
              />
            </div>
          )}
        </ItemRow>
      ))}
    </SectionPage>
  );
}
