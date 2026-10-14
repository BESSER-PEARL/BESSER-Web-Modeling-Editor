import React from 'react';
import { useTranslation } from 'react-i18next';
import { AgentComponentType } from '@besser/wme';
import { ItemRow } from '../ui/ItemRow';
import { TextField } from '../ui/fields';
import { EmptyHint, SectionPage, WarningBanner } from '../ui/SectionPage';
import type { SectionProps } from './types';

export function SkillsSection({ store, expandedId, toggle, expand }: SectionProps) {
  const { t } = useTranslation();
  const { skills, hasReasoningState, updateComponent, removeComponent } = store;

  return (
    <SectionPage
      title={t('agentComponents.skills.title')}
      description={t('agentComponents.skills.description')}
      onAdd={() => expand(store.addComponent(AgentComponentType.AgentSkill))}
      addLabel={t('agentComponents.skills.addLabel')}
    >
      {!hasReasoningState && <WarningBanner message={t('agentComponents.skills.warning')} />}
      {skills.length === 0 && <EmptyHint message={t('agentComponents.skills.empty')} />}
      {skills.map((el) => (
        <ItemRow
          key={el.id}
          name={el.name}
          expanded={expandedId === el.id}
          onToggle={() => toggle(el.id)}
          onDelete={() => removeComponent(el.id)}
        >
          <TextField
            id={`skill-name-${el.id}`}
            label={t('agentComponents.skills.name')}
            value={el.name || ''}
            onChange={v => updateComponent(el.id, { name: v })}
            placeholder={t('agentComponents.skills.namePlaceholder')}
          />
          <TextField
            id={`skill-desc-${el.id}`}
            label={t('agentComponents.skills.skillDescription')}
            value={el.description || ''}
            onChange={v => updateComponent(el.id, { description: v })}
            placeholder={t('agentComponents.skills.skillDescriptionPlaceholder')}
            multiline
          />
          <TextField
            id={`skill-content-${el.id}`}
            label={t('agentComponents.skills.content')}
            value={el.content || ''}
            onChange={v => updateComponent(el.id, { content: v })}
            placeholder={t('agentComponents.skills.contentPlaceholder')}
            multiline
          />
        </ItemRow>
      ))}
    </SectionPage>
  );
}
