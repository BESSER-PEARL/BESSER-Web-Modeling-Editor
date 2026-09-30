import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { AgentComponentType } from '@besser/wme';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ItemRow } from '../ui/ItemRow';
import { TextField } from '../ui/fields';
import { EmptyHint, SectionPage } from '../ui/SectionPage';
import { intentBodyIds } from '../agentComponentModel';
import type { SectionProps } from './types';

export function IntentsSection({ store, expandedId, toggle, expand }: SectionProps) {
  const { t } = useTranslation();
  const { intents, components, updateComponent, removeComponent } = store;

  return (
    <SectionPage
      title={t('agentComponents.intents.title')}
      description={t('agentComponents.intents.description')}
      onAdd={() => expand(store.addComponent(AgentComponentType.AgentIntent))}
      addLabel={t('agentComponents.intents.addLabel')}
    >
      {intents.length === 0 && <EmptyHint message={t('agentComponents.intents.empty')} />}
      {intents.map((el) => {
        const bodies = intentBodyIds(el)
          .map((id) => components[id])
          .filter((body) => body && (body.type as string) === AgentComponentType.AgentIntentBody);
        return (
          <ItemRow
            key={el.id}
            name={el.name}
            badge={bodies.length > 0 ? t('agentComponents.intents.sentenceCount', { count: bodies.length }) : undefined}
            expanded={expandedId === el.id}
            onToggle={() => toggle(el.id)}
            onDelete={() => removeComponent(el.id)}
          >
            <TextField
              id={`intent-name-${el.id}`}
              label={t('agentComponents.intents.name')}
              value={el.name || ''}
              onChange={v => updateComponent(el.id, { name: v })}
              placeholder={t('agentComponents.intents.namePlaceholder')}
            />
            <TextField
              id={`intent-desc-${el.id}`}
              label={t('agentComponents.intents.intentDescription')}
              value={el.intent_description || ''}
              onChange={v => updateComponent(el.id, { intent_description: v })}
              placeholder={t('agentComponents.intents.intentDescriptionPlaceholder')}
              multiline
            />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">{t('agentComponents.intents.trainingSentences')}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 text-xs px-2"
                  onClick={() => store.addTrainingSentence(el.id)}
                >
                  <Plus className="h-3 w-3" /> {t('agentComponents.intents.addSentence')}
                </Button>
              </div>
              {bodies.length === 0 && (
                <p className="text-[11px] text-muted-foreground italic">
                  {t('agentComponents.intents.noSentences')}
                </p>
              )}
              {bodies.map((body) => (
                <div key={body.id} className="flex items-center gap-2">
                  <Input
                    value={body.name || ''}
                    onChange={e => store.updateTrainingSentence(body.id, e.target.value)}
                    placeholder={t('agentComponents.intents.sentencePlaceholder')}
                    className="h-7 text-sm flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => store.removeTrainingSentence(el.id, body.id)}
                    title={t('agentComponents.remove')}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </ItemRow>
        );
      })}
    </SectionPage>
  );
}
