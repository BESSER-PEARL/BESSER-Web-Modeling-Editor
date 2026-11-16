/**
 * What the next Spec-Driven generation will use (own key, free tier or
 * nothing), shown beside the chat; clicking it opens the key dialog.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { KeyRound, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';
import { llmProviderLabel } from '../../../shared/components/byok/LlmKeyDialog';
import { useGenerationKey, type GenerationKey } from '../../spec-driven';

export function generationKeyLabel(key: GenerationKey, t: TFunction): string {
  if (key.tier === 'own') {
    return t('assistant.generationKey.own', {
      provider: llmProviderLabel(key.provider ?? ''),
      model: key.model || t('assistant.generationKey.defaultModel'),
    });
  }
  return key.tier === 'free' ? t('assistant.generationKey.free') : t('assistant.generationKey.none');
}

export const GenerationKeyChip: React.FC<{ onClick: () => void; className?: string }> = ({ onClick, className }) => {
  const { t } = useTranslation();
  const key = useGenerationKey();
  // Unknown until the server says whether the free tier is offered.
  if (!key) return null;
  const label = generationKeyLabel(key, t);
  const Icon = key.tier === 'free' ? Sparkles : KeyRound;
  return (
    <button
      type="button"
      onClick={onClick}
      title={t('assistant.generationKey.title', { label })}
      aria-label={t('assistant.generationKey.title', { label })}
      className={cn(
        'inline-flex min-w-0 max-w-[14rem] items-center gap-1 rounded-full border border-border/50 bg-background/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-brand/30 hover:bg-brand/5 hover:text-foreground',
        className,
      )}
    >
      <Icon className={cn('size-3 shrink-0', key.tier === 'none' ? 'text-muted-foreground' : 'text-brand')} />
      <span className="truncate">{label}</span>
    </button>
  );
};
