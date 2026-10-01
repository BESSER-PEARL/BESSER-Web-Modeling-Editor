import React from 'react';
import { useTranslation } from 'react-i18next';
import { AgentComponentType } from '@besser/wme';
import { ItemRow } from '../ui/ItemRow';
import { Field, TextField } from '../ui/fields';
import { PythonCodeEditor } from '../ui/PythonCodeEditor';
import { EmptyHint, SectionPage, WarningBanner } from '../ui/SectionPage';
import { DEFAULT_TOOL_CODE } from '../agentComponentModel';
import type { SectionProps } from './types';

export function ToolsSection({ store, expandedId, toggle, expand }: SectionProps) {
  const { t } = useTranslation();
  const { tools, hasReasoningState, updateComponent, removeComponent } = store;

  return (
    <SectionPage
      title={t('agentComponents.tools.title')}
      description={t('agentComponents.tools.description')}
      onAdd={() => expand(store.addComponent(AgentComponentType.AgentTool))}
      addLabel={t('agentComponents.tools.addLabel')}
    >
      {!hasReasoningState && <WarningBanner message={t('agentComponents.tools.warning')} />}
      {tools.length === 0 && <EmptyHint message={t('agentComponents.tools.empty')} />}
      {tools.map((el) => (
        <ItemRow
          key={el.id}
          name={el.name}
          expanded={expandedId === el.id}
          onToggle={() => toggle(el.id)}
          onDelete={() => removeComponent(el.id)}
        >
          <TextField
            id={`tool-name-${el.id}`}
            label={t('agentComponents.tools.name')}
            value={el.name || ''}
            onChange={v => updateComponent(el.id, { name: v })}
            placeholder={t('agentComponents.tools.namePlaceholder')}
          />
          <TextField
            id={`tool-desc-${el.id}`}
            label={t('agentComponents.tools.toolDescription')}
            value={el.description || ''}
            onChange={v => updateComponent(el.id, { description: v })}
            placeholder={t('agentComponents.tools.toolDescriptionPlaceholder')}
            multiline
          />
          <Field id={`tool-code-${el.id}`} label={t('agentComponents.tools.code')} description={t('agentComponents.tools.codeDescription')}>
            <PythonCodeEditor
              value={el.code || DEFAULT_TOOL_CODE}
              onChange={v => updateComponent(el.id, { code: v })}
            />
          </Field>
        </ItemRow>
      ))}
    </SectionPage>
  );
}
