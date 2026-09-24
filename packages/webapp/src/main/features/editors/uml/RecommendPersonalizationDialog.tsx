import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks';
import {
  selectActiveDiagram,
  bumpEditorRevision,
  updateDiagramModelThunk,
} from '../../../app/store/workspaceSlice';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { BACKEND_URL } from '../../../shared/constants/constant';
import {
  splitUserDiagramIntoProfiles,
  mergeSingletonBoxes,
  reinjectHiddenContainers,
} from '../../../shared/utils/user-profile-graph';
import type {
  UserPersonalizationSpec,
  UserPresentationSpec,
  UserModalitySpec,
  UserContentSpec,
} from '@besser/wme';

type Method = 'rules' | 'llm' | 'rag';
type Step = 'method' | 'profiles' | 'review';

export interface RecommendPersonalizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Maps backend field paths (from recommendedChanges) to UserPersonalizationSpec locations
const FIELD_TO_SPEC: Record<string, { section: 'presentation' | 'modality' | 'content'; key: string }> = {
  'presentation.agentLanguage':        { section: 'presentation', key: 'language' },
  'presentation.agentStyle':           { section: 'presentation', key: 'style' },
  'presentation.languageComplexity':   { section: 'presentation', key: 'languageComplexity' },
  'presentation.sentenceLength':       { section: 'presentation', key: 'sentenceLength' },
  'presentation.useAbbreviations':     { section: 'presentation', key: 'useAbbreviations' },
  'presentation.interfaceStyle.size':  { section: 'presentation', key: 'size' },
  'presentation.interfaceStyle.font':  { section: 'presentation', key: 'font' },
  'presentation.interfaceStyle.lineSpacing': { section: 'presentation', key: 'lineSpacing' },
  'presentation.interfaceStyle.alignment':   { section: 'presentation', key: 'alignment' },
  'presentation.interfaceStyle.color':       { section: 'presentation', key: 'color' },
  'presentation.interfaceStyle.contrast':    { section: 'presentation', key: 'contrast' },
  'presentation.voiceStyle.gender':    { section: 'modality', key: 'voiceGender' },
  'presentation.voiceStyle.speed':     { section: 'modality', key: 'voiceSpeed' },
  'modality.inputModalities':          { section: 'modality', key: 'inputModalities' },
  'modality.outputModalities':         { section: 'modality', key: 'outputModalities' },
  'content.adaptContentToUserProfile': { section: 'content', key: 'adaptContentToUserProfile' },
};

const FIELD_LABELS: Record<string, string> = {
  'presentation.agentLanguage':        'Language',
  'presentation.agentStyle':           'Style',
  'presentation.languageComplexity':   'Language Complexity',
  'presentation.sentenceLength':       'Sentence Length',
  'presentation.useAbbreviations':     'Use Abbreviations',
  'presentation.interfaceStyle.size':  'Font Size',
  'presentation.interfaceStyle.font':  'Font Family',
  'presentation.interfaceStyle.lineSpacing': 'Line Spacing',
  'presentation.interfaceStyle.alignment':   'Alignment',
  'presentation.interfaceStyle.color':       'Text Color',
  'presentation.interfaceStyle.contrast':    'Contrast',
  'presentation.voiceStyle.gender':    'Voice Gender',
  'presentation.voiceStyle.speed':     'Voice Speed',
  'modality.inputModalities':          'Input Modalities',
  'modality.outputModalities':         'Output Modalities',
  'content.adaptContentToUserProfile': 'Adapt Content',
};

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === null || value === undefined) return '—';
  return String(value);
}

interface ChangeEntry {
  field: string;
  from: unknown;
  to: unknown;
  enabled: boolean;
}

interface ProfileRecommendation {
  profile: ReturnType<typeof splitUserDiagramIntoProfiles>[number];
  changes: ChangeEntry[];
}

function buildSpecFromChanges(changes: ChangeEntry[]): UserPersonalizationSpec {
  const spec: UserPersonalizationSpec = {};
  for (const change of changes) {
    if (!change.enabled) continue;
    const mapping = FIELD_TO_SPEC[change.field];
    if (!mapping) continue;
    if (!spec[mapping.section]) (spec as Record<string, unknown>)[mapping.section] = {};
    ((spec as Record<string, Record<string, unknown>>)[mapping.section])[mapping.key] = change.to;
  }
  return spec;
}

export const RecommendPersonalizationDialog: React.FC<RecommendPersonalizationDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const activeDiagram = useAppSelector(selectActiveDiagram);

  const [step, setStep] = useState<Step>('method');
  const [method, setMethod] = useState<Method>('rules');
  const [selectedBoxIds, setSelectedBoxIds] = useState<Set<string>>(new Set());
  const [isFetching, setIsFetching] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [profileRecommendations, setProfileRecommendations] = useState<ProfileRecommendation[]>([]);

  useEffect(() => {
    if (open) {
      setStep('method');
      setMethod('rules');
      setSelectedBoxIds(new Set());
      setIsFetching(false);
      setIsApplying(false);
      setProfileRecommendations([]);
    }
  }, [open]);

  const profiles = useMemo(
    () => splitUserDiagramIntoProfiles(activeDiagram?.model as any),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeDiagram?.model],
  );

  const toggleBoxId = (id: string) => {
    setSelectedBoxIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleMethodNext = () => {
    if (method === 'rag') {
      toast.info(t('agentConfig.toasts.ragSoon'));
      return;
    }
    setSelectedBoxIds(new Set(profiles.map((p) => p.rootBoxId)));
    setStep('profiles');
  };

  const handleFetchRecommendations = useCallback(async () => {
    if (!activeDiagram?.model) return;
    if (selectedBoxIds.size === 0) {
      toast.error(t('recommendPersonalization.noProfilesSelected'));
      return;
    }

    const selectedProfiles = profiles.filter((p) => selectedBoxIds.has(p.rootBoxId));
    setIsFetching(true);

    const results: ProfileRecommendation[] = [];

    try {
      for (const profile of selectedProfiles) {
        const profileModel = reinjectHiddenContainers(mergeSingletonBoxes(profile.model));

        const body: Record<string, unknown> = {
          userProfileName: profile.name,
          userProfileModel: structuredClone(profileModel),
          currentConfig: {},
        };
        if (method === 'llm') body.model = 'gpt-4o';

        const endpoint =
          method === 'llm'
            ? `${BACKEND_URL}/recommend-agent-config-llm`
            : `${BACKEND_URL}/recommend-agent-config-mapping`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => String(response.status));
          throw new Error(errorText);
        }

        const data = await response.json() as {
          config?: Record<string, unknown>;
          recommendedChanges?: Array<{ field: string; from: unknown; to: unknown }>;
        };

        if (!data.config) throw new Error(t('recommendPersonalization.invalidResponse'));

        // Use the explicit diff list; fall back to an empty list if the backend is older
        const rawChanges = data.recommendedChanges ?? [];
        const mappableChanges: ChangeEntry[] = rawChanges
          .filter((c) => FIELD_TO_SPEC[c.field] !== undefined)
          .map((c) => ({ ...c, enabled: true }));

        results.push({ profile, changes: mappableChanges });
      }

      setProfileRecommendations(results);
      setStep('review');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(t('recommendPersonalization.failed', { message: msg }));
    } finally {
      setIsFetching(false);
    }
  }, [activeDiagram, profiles, selectedBoxIds, method, t]);

  const toggleChange = (profileIdx: number, changeIdx: number) => {
    setProfileRecommendations((prev) =>
      prev.map((pr, pi) =>
        pi !== profileIdx
          ? pr
          : {
              ...pr,
              changes: pr.changes.map((c, ci) =>
                ci !== changeIdx ? c : { ...c, enabled: !c.enabled },
              ),
            },
      ),
    );
  };

  const toggleAllChanges = (profileIdx: number, enabled: boolean) => {
    setProfileRecommendations((prev) =>
      prev.map((pr, pi) =>
        pi !== profileIdx ? pr : { ...pr, changes: pr.changes.map((c) => ({ ...c, enabled })) },
      ),
    );
  };

  const handleApply = useCallback(async () => {
    if (!activeDiagram?.model) return;

    setIsApplying(true);
    const updatedModel = structuredClone(activeDiagram.model) as any;
    const elements = (updatedModel.elements ?? {}) as Record<string, any>;

    try {
      for (const { profile, changes } of profileRecommendations) {
        if (elements[profile.rootBoxId]) {
          elements[profile.rootBoxId].personalization = buildSpecFromChanges(changes);
        }
      }

      await dispatch(updateDiagramModelThunk({ model: updatedModel })).unwrap();
      dispatch(bumpEditorRevision());
      toast.success(t('recommendPersonalization.applied'));
      onOpenChange(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(t('recommendPersonalization.failed', { message: msg }));
    } finally {
      setIsApplying(false);
    }
  }, [activeDiagram, profileRecommendations, dispatch, onOpenChange, t]);

  const methodHint =
    method === 'rules'
      ? t('agentConfig.loading.rules')
      : method === 'llm'
        ? t('agentConfig.loading.llm')
        : t('agentConfig.toasts.ragSoon');

  const totalEnabledChanges = profileRecommendations.reduce(
    (sum, pr) => sum + pr.changes.filter((c) => c.enabled).length,
    0,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t('recommendPersonalization.title')}</DialogTitle>
          <DialogDescription>
            {step === 'review'
              ? t('recommendPersonalization.reviewDescription')
              : t('recommendPersonalization.description')}
          </DialogDescription>
        </DialogHeader>

        {step === 'method' && (
          <div className="space-y-4 py-2">
            <p className="text-sm font-medium">{t('recommendPersonalization.chooseMethod')}</p>
            <RadioGroup value={method} onValueChange={(v) => setMethod(v as Method)}>
              <RadioGroupItem value="rules">{t('recommendPersonalization.methodRules')}</RadioGroupItem>
              <RadioGroupItem value="llm">{t('recommendPersonalization.methodLlm')}</RadioGroupItem>
              <RadioGroupItem value="rag" disabled>{t('recommendPersonalization.methodRag')}</RadioGroupItem>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">{methodHint}</p>
          </div>
        )}

        {step === 'profiles' && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">{t('recommendPersonalization.selectProfilesHint')}</p>
            {profiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('recommendPersonalization.noProfiles')}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {profiles.map((p) => (
                  <label
                    key={p.rootBoxId}
                    className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-muted/40"
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-[hsl(var(--brand))]"
                      checked={selectedBoxIds.has(p.rootBoxId)}
                      onChange={() => toggleBoxId(p.rootBoxId)}
                    />
                    <span className="text-sm font-medium">
                      {p.name || t('personalize.unnamedUser')}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'review' && (
          <div className="max-h-[400px] space-y-3 overflow-y-auto py-2 pr-1">
            {profileRecommendations.map((pr, profileIdx) => (
              <div key={pr.profile.rootBoxId} className="rounded-md border">
                {/* Profile header */}
                <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
                  <span className="text-sm font-semibold">
                    {pr.profile.name || t('personalize.unnamedUser')}
                  </span>
                  {pr.changes.length > 0 && (
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <button
                        type="button"
                        className="hover:text-foreground"
                        onClick={() => toggleAllChanges(profileIdx, true)}
                      >
                        {t('recommendPersonalization.selectAll')}
                      </button>
                      <span>/</span>
                      <button
                        type="button"
                        className="hover:text-foreground"
                        onClick={() => toggleAllChanges(profileIdx, false)}
                      >
                        {t('recommendPersonalization.deselectAll')}
                      </button>
                    </div>
                  )}
                </div>

                {pr.changes.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-muted-foreground">
                    {t('recommendPersonalization.noChanges')}
                  </p>
                ) : (
                  <div className="divide-y">
                    {pr.changes.map((change, changeIdx) => (
                      <label
                        key={change.field}
                        className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-muted/30"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 shrink-0 accent-[hsl(var(--brand))]"
                          checked={change.enabled}
                          onChange={() => toggleChange(profileIdx, changeIdx)}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-medium">
                            {FIELD_LABELS[change.field] ?? change.field}
                          </span>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="line-through opacity-60">{formatValue(change.from)}</span>
                            <span>→</span>
                            <span className="font-medium text-foreground">{formatValue(change.to)}</span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          {step === 'method' && (
            <Button onClick={handleMethodNext} disabled={method === 'rag'}>
              {t('recommendPersonalization.next')}
            </Button>
          )}
          {step === 'profiles' && (
            <>
              <Button variant="outline" onClick={() => setStep('method')} disabled={isFetching}>
                {t('recommendPersonalization.back')}
              </Button>
              <Button
                onClick={() => { void handleFetchRecommendations(); }}
                disabled={isFetching || selectedBoxIds.size === 0}
              >
                {isFetching
                  ? t('recommendPersonalization.fetching')
                  : t('recommendPersonalization.getRecommendations')}
              </Button>
            </>
          )}
          {step === 'review' && (
            <>
              <Button variant="outline" onClick={() => setStep('profiles')} disabled={isApplying}>
                {t('recommendPersonalization.back')}
              </Button>
              <Button
                onClick={() => { void handleApply(); }}
                disabled={isApplying || totalEnabledChanges === 0}
              >
                {isApplying
                  ? t('agentConfig.loadingTitle')
                  : t('recommendPersonalization.applySelected', { count: totalEnabledChanges })}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
