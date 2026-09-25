import React from 'react';
import { useTranslation } from 'react-i18next';
import { AgentComponentType } from '@besser/wme';
import { ItemRow } from '../ui/ItemRow';
import { CheckboxField, NumberField, TextField } from '../ui/fields';
import { EmptyHint, SectionPage, WarningBanner } from '../ui/SectionPage';
import type { SectionProps } from './types';

export function WorkspacesSection({ store, expandedId, toggle, expand }: SectionProps) {
  const { t } = useTranslation();
  const { workspaces, hasReasoningState, updateComponent, removeComponent } = store;

  return (
    <SectionPage
      title={t('agentComponents.workspaces.title')}
      description={t('agentComponents.workspaces.description')}
      onAdd={() => expand(store.addComponent(AgentComponentType.AgentWorkspace))}
      addLabel={t('agentComponents.workspaces.addLabel')}
    >
      {!hasReasoningState && <WarningBanner message={t('agentComponents.workspaces.warning')} />}
      {workspaces.length === 0 && <EmptyHint message={t('agentComponents.workspaces.empty')} />}
      {workspaces.map((el) => (
        <ItemRow
          key={el.id}
          name={el.name}
          badge={el.writable ? t('agentComponents.workspaces.badgeWritable') : t('agentComponents.workspaces.badgeReadOnly')}
          expanded={expandedId === el.id}
          onToggle={() => toggle(el.id)}
          onDelete={() => removeComponent(el.id)}
        >
          <TextField
            id={`ws-name-${el.id}`}
            label={t('agentComponents.workspaces.name')}
            value={el.name || ''}
            onChange={v => updateComponent(el.id, { name: v })}
            placeholder={t('agentComponents.workspaces.namePlaceholder')}
          />
          <TextField
            id={`ws-path-${el.id}`}
            label={t('agentComponents.workspaces.path')}
            value={el.path || ''}
            onChange={v => updateComponent(el.id, { path: v })}
            placeholder={t('agentComponents.workspaces.pathPlaceholder')}
            description={t('agentComponents.workspaces.pathDescription')}
          />
          <TextField
            id={`ws-desc-${el.id}`}
            label={t('agentComponents.workspaces.wsDescription')}
            value={el.description || ''}
            onChange={v => updateComponent(el.id, { description: v })}
            placeholder={t('agentComponents.workspaces.wsDescriptionPlaceholder')}
            multiline
          />
          <div className="grid grid-cols-2 gap-4">
            <CheckboxField
              id={`ws-writable-${el.id}`}
              label={t('agentComponents.workspaces.writable')}
              value={el.writable ?? true}
              onChange={v => updateComponent(el.id, { writable: v })}
              description={t('agentComponents.workspaces.writableDescription')}
            />
            <NumberField
              id={`ws-maxbytes-${el.id}`}
              label={t('agentComponents.workspaces.maxReadBytes')}
              value={el.max_read_bytes ?? 200000}
              onChange={v => updateComponent(el.id, { max_read_bytes: Math.max(0, v) })}
              min={0}
            />
          </div>
        </ItemRow>
      ))}
    </SectionPage>
  );
}
