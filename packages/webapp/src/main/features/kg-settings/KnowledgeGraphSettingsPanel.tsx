import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useProject } from '../../app/hooks/useProject';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import {
  DEFAULT_KG_HARD_LIMIT,
  DEFAULT_KG_LAYOUT,
  DEFAULT_KG_SHOW_META_VOCAB,
  DEFAULT_KG_SOFT_LIMIT,
  getActiveDiagram,
  getKgHardLimit,
  getKgLayout,
  getKgShowMetaVocab,
  getKgSoftLimit,
  isKnowledgeGraphData,
} from '../../shared/types/project';
import type { KnowledgeGraphData, KnowledgeGraphLayout } from '../../shared/types/project';

const MIN = 1;
const MAX = 10000;

/** KG-specific settings page. Two limits:
 *  - Soft: how many nodes are auto-shown on import / reseed.
 *  - Hard: absolute ceiling; user can't exceed it without raising the limit. */
/** Inline `<code>` wrapper for the RDF vocabulary tokens spliced into the
 *  meta-vocabulary help text via `<Trans>`. */
const VocabCode: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <code className="rounded bg-muted px-1 py-0.5">{children}</code>
);

export const KnowledgeGraphSettingsPanel: React.FC = () => {
  const { t } = useTranslation();
  const { currentProject } = useProject();
  const navigate = useNavigate();

  const kgDiagram = currentProject ? getActiveDiagram(currentProject, 'KnowledgeGraphDiagram') : undefined;
  const storedModel = useMemo<KnowledgeGraphData | null>(() => {
    const m = kgDiagram?.model;
    return isKnowledgeGraphData(m) ? m : null;
  }, [kgDiagram?.model]);

  const storedSoft = storedModel?.settings?.softLimit ?? storedModel?.settings?.maxVisibleNodes;
  const storedHard = storedModel?.settings?.hardLimit;
  const storedLayout = storedModel?.settings?.layout;
  const storedShowMeta = storedModel?.settings?.showMetaVocabNodes;

  const [softInput, setSoftInput] = useState<string>(storedSoft != null ? String(storedSoft) : '');
  const [hardInput, setHardInput] = useState<string>(storedHard != null ? String(storedHard) : '');
  const [layoutInput, setLayoutInput] = useState<KnowledgeGraphLayout>(storedLayout ?? DEFAULT_KG_LAYOUT);
  const [showMetaInput, setShowMetaInput] = useState<boolean>(
    storedShowMeta ?? DEFAULT_KG_SHOW_META_VOCAB,
  );

  useEffect(() => {
    setSoftInput(storedSoft != null ? String(storedSoft) : '');
    setHardInput(storedHard != null ? String(storedHard) : '');
    setLayoutInput(storedLayout ?? DEFAULT_KG_LAYOUT);
    setShowMetaInput(storedShowMeta ?? DEFAULT_KG_SHOW_META_VOCAB);
  }, [storedSoft, storedHard, storedLayout, storedShowMeta]);

  const parseOrDefault = (s: string, fallback: number): number => {
    const t = s.trim();
    if (t === '') return fallback;
    const n = Number(t);
    return Number.isInteger(n) ? n : NaN;
  };
  const softVal = parseOrDefault(softInput, DEFAULT_KG_SOFT_LIMIT);
  const hardVal = parseOrDefault(hardInput, DEFAULT_KG_HARD_LIMIT);

  const softValid = Number.isFinite(softVal) && softVal >= MIN && softVal <= MAX;
  const hardValid = Number.isFinite(hardVal) && hardVal >= MIN && hardVal <= MAX;
  const orderValid = softVal <= hardVal;

  const appliedStoredLayout = getKgLayout(storedModel?.settings);
  const appliedStoredShowMeta = getKgShowMetaVocab(storedModel?.settings);
  const isDirty =
    (softInput.trim() === '' ? storedSoft != null : softVal !== storedSoft) ||
    (hardInput.trim() === '' ? storedHard != null : hardVal !== storedHard) ||
    layoutInput !== appliedStoredLayout ||
    showMetaInput !== appliedStoredShowMeta;
  const canSave = isDirty && softValid && hardValid && orderValid;

  const save = () => {
    if (!currentProject) return;
    const project = ProjectStorageRepository.loadProject(currentProject.id);
    if (!project) return;
    const active = getActiveDiagram(project, 'KnowledgeGraphDiagram');
    if (!active || !isKnowledgeGraphData(active.model)) return;

    const nextSettings = { ...(active.model.settings ?? {}) };
    if (softInput.trim() === '') {
      delete (nextSettings as any).softLimit;
    } else {
      nextSettings.softLimit = softVal;
    }
    if (hardInput.trim() === '') {
      delete (nextSettings as any).hardLimit;
    } else {
      nextSettings.hardLimit = hardVal;
    }
    if (layoutInput === DEFAULT_KG_LAYOUT) {
      delete (nextSettings as any).layout;
    } else {
      nextSettings.layout = layoutInput;
    }
    if (showMetaInput === DEFAULT_KG_SHOW_META_VOCAB) {
      delete (nextSettings as any).showMetaVocabNodes;
    } else {
      nextSettings.showMetaVocabNodes = showMetaInput;
    }
    // Clear the legacy field once either of the new ones is written.
    delete (nextSettings as any).maxVisibleNodes;

    // If the layout algorithm changed, wipe persisted node positions so the
    // editor re-runs the newly-chosen layout on its next sync pass (which
    // fires as soon as the user navigates back to the editor).
    const layoutChanged = layoutInput !== appliedStoredLayout;
    const nextNodes = layoutChanged
      ? active.model.nodes.map((n) => {
          const { position: _discarded, ...rest } = n;
          return rest;
        })
      : active.model.nodes;

    const nextModel: KnowledgeGraphData = { ...active.model, nodes: nextNodes, settings: nextSettings };
    const ok = ProjectStorageRepository.updateDiagram(project.id, 'KnowledgeGraphDiagram', {
      ...active,
      model: nextModel,
      lastUpdate: new Date().toISOString(),
    });
    if (ok) toast.success(t('editors.kg.settings.saved'));
    else toast.error(t('editors.kg.settings.saveFailed'));
  };

  const resetToDefault = () => {
    setSoftInput('');
    setHardInput('');
    setLayoutInput(DEFAULT_KG_LAYOUT);
    setShowMetaInput(DEFAULT_KG_SHOW_META_VOCAB);
  };

  if (!currentProject || !kgDiagram) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('editors.kg.settings.title')}</CardTitle>
            <CardDescription>{t('editors.kg.settings.noActiveDiagram')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate('/')}>
              <ArrowLeft className="mr-2 size-4" />
              {t('editors.kg.settings.backToEditor')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalNodes = storedModel?.nodes.length ?? 0;
  const appliedSoft = getKgSoftLimit(storedModel?.settings);
  const appliedHard = getKgHardLimit(storedModel?.settings);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-1">
          <ArrowLeft className="size-4" />
          {t('editors.kg.settings.backToEditor')}
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('editors.kg.settings.title')}</CardTitle>
          <CardDescription>{t('editors.kg.settings.description', { title: kgDiagram.title })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="space-y-2">
            <Label htmlFor="kg-soft-limit">{t('editors.kg.settings.softLimitLabel')}</Label>
            <div className="flex items-center gap-2">
              <Input
                id="kg-soft-limit"
                type="number"
                min={MIN}
                max={MAX}
                step={1}
                placeholder={t('editors.kg.settings.defaultPlaceholder', { value: DEFAULT_KG_SOFT_LIMIT })}
                value={softInput}
                onChange={(e) => setSoftInput(e.target.value)}
                className="w-40"
              />
              <span className="text-xs text-muted-foreground">{t('editors.kg.settings.softLimitHelp')}</span>
            </div>
            {softInput.trim() !== '' && !softValid && (
              <p className="text-xs text-destructive">
                {t('editors.kg.settings.rangeError', { min: MIN, max: MAX })}
              </p>
            )}
          </section>

          <section className="space-y-2">
            <Label htmlFor="kg-hard-limit">{t('editors.kg.settings.hardLimitLabel')}</Label>
            <div className="flex items-center gap-2">
              <Input
                id="kg-hard-limit"
                type="number"
                min={MIN}
                max={MAX}
                step={1}
                placeholder={t('editors.kg.settings.defaultPlaceholder', { value: DEFAULT_KG_HARD_LIMIT })}
                value={hardInput}
                onChange={(e) => setHardInput(e.target.value)}
                className="w-40"
              />
              <span className="text-xs text-muted-foreground">{t('editors.kg.settings.hardLimitHelp')}</span>
            </div>
            {hardInput.trim() !== '' && !hardValid && (
              <p className="text-xs text-destructive">
                {t('editors.kg.settings.rangeError', { min: MIN, max: MAX })}
              </p>
            )}
            {softValid && hardValid && !orderValid && (
              <p className="text-xs text-destructive">
                {t('editors.kg.settings.softExceedsHard', { soft: softVal, hard: hardVal })}
              </p>
            )}
          </section>

          <section className="space-y-2">
            <Label htmlFor="kg-layout">{t('editors.kg.settings.layoutLabel')}</Label>
            <div className="flex items-center gap-2">
              <select
                id="kg-layout"
                value={layoutInput}
                onChange={(e) => setLayoutInput(e.target.value as KnowledgeGraphLayout)}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                {/* `value` is the persisted setting -- never translated. The
                  * algorithm names stay too; only the descriptions change. */}
                <option value="concentric">{t('editors.kg.settings.layoutConcentric')}</option>
                <option value="fcose">{t('editors.kg.settings.layoutFcose')}</option>
                <option value="grid">{t('editors.kg.settings.layoutGrid')}</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">{t('editors.kg.settings.layoutHelp')}</p>
          </section>

          <section className="space-y-2">
            <Label htmlFor="kg-show-meta-vocab">{t('editors.kg.settings.metaVocabLabel')}</Label>
            <div className="flex items-start gap-2">
              <input
                id="kg-show-meta-vocab"
                type="checkbox"
                checked={showMetaInput}
                onChange={(e) => setShowMetaInput(e.target.checked)}
                className="mt-0.5 size-4"
              />
              {/* Self-closing component slots keep the vocabulary tokens out of
                * webapp.json entirely, so no translator can localise
                * `sh:NodeShape` and the parity checker never diffs them. */}
              <span className="text-xs text-muted-foreground">
                <Trans
                  i18nKey="editors.kg.settings.metaVocabHelp"
                  components={{
                    owl: <VocabCode>owl:</VocabCode>,
                    rdf: <VocabCode>rdf:</VocabCode>,
                    rdfs: <VocabCode>rdfs:</VocabCode>,
                    shNodeShape: <VocabCode>sh:NodeShape</VocabCode>,
                    shPropertyShape: <VocabCode>sh:PropertyShape</VocabCode>,
                    xsd: <VocabCode>xsd:</VocabCode>,
                    sh: <VocabCode>sh:</VocabCode>,
                  }}
                />
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{t('editors.kg.settings.metaVocabNote')}</p>
          </section>

          {/* Split on the separators: each clause carries its own count, and
            * the layout name is a persisted value rendered raw. */}
          <p className="text-xs text-muted-foreground">
            {t('editors.kg.settings.summaryNodes', { count: totalNodes })} ·{' '}
            {t('editors.kg.settings.summarySoft', { value: appliedSoft })} ·{' '}
            {t('editors.kg.settings.summaryHard', { value: appliedHard })} ·{' '}
            {t('editors.kg.settings.summaryLayout')}{' '}
            <code className="rounded bg-muted px-1 py-0.5">{appliedStoredLayout}</code>.
          </p>

          <Separator />

          <div className="flex items-center gap-2">
            <Button onClick={save} disabled={!canSave}>
              {t('common.save')}
            </Button>
            <Button
              variant="outline"
              onClick={resetToDefault}
              disabled={
                storedSoft == null &&
                storedHard == null &&
                storedLayout == null &&
                storedShowMeta == null &&
                softInput.trim() === '' &&
                hardInput.trim() === '' &&
                layoutInput === DEFAULT_KG_LAYOUT &&
                showMetaInput === DEFAULT_KG_SHOW_META_VOCAB
              }
            >
              {t('editors.kg.settings.resetToDefaults')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
