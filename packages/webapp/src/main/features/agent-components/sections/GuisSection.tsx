import React from 'react';
import { useTranslation } from 'react-i18next';
import { AgentComponentType } from '@besser/wme';
import { AgentGUIEditor } from '../AgentGUIEditor';
import { ItemRow } from '../ui/ItemRow';
import { CheckboxField, TextField } from '../ui/fields';
import { EmptyHint, SectionPage } from '../ui/SectionPage';
import type { SectionProps } from './types';

export interface GuisSectionProps extends SectionProps {
  /** GUI whose design editor is open (the panel widens while one is open). */
  openEditorGuiId: string | null;
  setOpenEditorGuiId: (id: string | null) => void;
}

export function GuisSection({ store, expandedId, toggle, expand, openEditorGuiId, setOpenEditorGuiId }: GuisSectionProps) {
  const { t } = useTranslation();
  const { guis, updateComponent, removeComponent } = store;

  return (
    <SectionPage
      title={t('agentComponents.guis.title')}
      description={t('agentComponents.guis.description')}
      onAdd={() => expand(store.addComponent(AgentComponentType.AgentGUI))}
      addLabel={t('agentComponents.guis.addLabel')}
    >
      {guis.length === 0 && <EmptyHint message={t('agentComponents.guis.empty')} />}
      {guis.map((el) => (
        <ItemRow
          key={el.id}
          name={el.gui_id || el.id}
          badge={el.is_form ? t('agentComponents.guis.badgeForm') : undefined}
          expanded={expandedId === el.id}
          onToggle={() => toggle(el.id)}
          onDelete={() => removeComponent(el.id)}
        >
          <TextField
            id={`gui-id-${el.id}`}
            label={t('agentComponents.guis.guiId')}
            value={el.gui_id || ''}
            onChange={v => updateComponent(el.id, { gui_id: v })}
            placeholder={t('agentComponents.guis.guiIdPlaceholder')}
            description={t('agentComponents.guis.guiIdDescription')}
          />
          <div className="grid grid-cols-2 gap-4">
            <CheckboxField
              id={`gui-persist-${el.id}`}
              label={t('agentComponents.guis.persist')}
              value={el.persist !== false}
              onChange={v => updateComponent(el.id, { persist: v })}
              description={t('agentComponents.guis.persistDescription')}
            />
            <CheckboxField
              id={`gui-isform-${el.id}`}
              label={t('agentComponents.guis.isForm')}
              value={!!el.is_form}
              onChange={v => updateComponent(el.id, { is_form: v })}
              description={t('agentComponents.guis.isFormDescription')}
            />
          </div>
          <TextField
            id={`gui-width-${el.id}`}
            label={t('agentComponents.guis.width')}
            value={el.width || ''}
            onChange={v => updateComponent(el.id, { width: v })}
            placeholder={t('agentComponents.guis.widthPlaceholder')}
            description={t('agentComponents.guis.widthDescription')}
          />
          {openEditorGuiId === el.id ? (
            <AgentGUIEditor
              initialData={el.guiModel ?? null}
              onSave={(data) => {
                updateComponent(el.id, { guiModel: data });
                setOpenEditorGuiId(null);
              }}
              onCancel={() => setOpenEditorGuiId(null)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setOpenEditorGuiId(el.id)}
              className="w-full rounded-md border border-dashed border-border px-4 py-3 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer"
            >
              {el.guiModel ? t('agentComponents.guis.editDesign') : t('agentComponents.guis.openEditor')}
            </button>
          )}
        </ItemRow>
      ))}
    </SectionPage>
  );
}
