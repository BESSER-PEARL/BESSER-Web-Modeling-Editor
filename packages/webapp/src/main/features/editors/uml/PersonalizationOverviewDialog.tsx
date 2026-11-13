import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Bot, CheckCircle2, Circle, Globe, Sparkles, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks';
import {
  selectProject,
  switchDiagramIndexThunk,
  switchDiagramTypeThunk,
} from '../../../app/store/workspaceSlice';
import type {
  GrapesJSProjectData,
  ProjectDiagram,
  SupportedDiagramType,
} from '../../../shared/types/project';
import { isUMLModel } from '../../../shared/types/project';
import { aggregateProfilePersonalization } from '../../../shared/utils/personalization-aggregation';
import { splitUserDiagramIntoProfiles } from '../../../shared/utils/user-profile-graph';
import { collectVariantProfiles } from '../../../shared/utils/buildWebAppVersions';
import { readAgentVariants } from '../../../shared/services/agent-variants/agent-variants-service';
import type { UMLModel } from '@besser/wme';

interface PersonalizationOverviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens the "Recommend personalization" flow for the active user diagram. */
  onRecommend?: () => void;
}

interface ProfileRow {
  /** `${userDiagramId}::${rootBoxId}` — same scheme as stored agent variants. */
  agentKey: string;
  /** Same scheme as `guiProfileOptions` (diagram id when it holds one profile). */
  guiKey: string;
  name: string;
  diagramTitle: string;
  /** Number of profile elements carrying a personalization spec. */
  specCount: number;
  /** Number of distinct settings that survive aggregation. */
  settingCount: number;
}

interface TargetColumn {
  type: Extract<SupportedDiagramType, 'AgentDiagram' | 'GUINoCodeDiagram'>;
  index: number;
  diagram: ProjectDiagram;
  /** Profile keys (agentKey/guiKey/name) that already have a personalized variant. */
  applied: { keys: Set<string>; names: Set<string> };
}

const countSettings = (config: Record<string, unknown>): number =>
  Object.values(config).reduce<number>((total, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return total + Object.keys(value).length;
    }
    return total + 1;
  }, 0);

export const PersonalizationOverviewDialog: React.FC<PersonalizationOverviewDialogProps> = ({
  open,
  onOpenChange,
  onRecommend,
}) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const project = useAppSelector(selectProject);

  const profiles = useMemo<ProfileRow[]>(() => {
    if (!open) return [];
    const rows: ProfileRow[] = [];
    for (const diagram of project?.diagrams?.UserDiagram ?? []) {
      if (!isUMLModel(diagram.model)) continue;
      const split = splitUserDiagramIntoProfiles(diagram.model as UMLModel);
      split.forEach((profile) => {
        const aggregated = aggregateProfilePersonalization(profile.model);
        rows.push({
          agentKey: `${diagram.id}::${profile.rootBoxId}`,
          guiKey: split.length === 1 ? diagram.id : `${diagram.id}::${profile.rootBoxId}`,
          name: profile.name || t('personalize.unnamedUser'),
          diagramTitle: diagram.title,
          specCount: aggregated.specs.length,
          settingCount: countSettings(aggregated.configuration as Record<string, unknown>),
        });
      });
    }
    return rows;
  }, [open, project, t]);

  const agents = useMemo<TargetColumn[]>(() => {
    if (!open) return [];
    return (project?.diagrams?.AgentDiagram ?? []).map((diagram, index) => {
      const variants = readAgentVariants(diagram);
      return {
        type: 'AgentDiagram' as const,
        index,
        diagram,
        applied: {
          keys: new Set(variants.map((v) => v.profileId)),
          names: new Set(variants.map((v) => v.profileName)),
        },
      };
    });
  }, [open, project]);

  const webUis = useMemo<TargetColumn[]>(() => {
    if (!open) return [];
    return (project?.diagrams?.GUINoCodeDiagram ?? []).map((diagram, index) => {
      const variants = collectVariantProfiles(diagram.model as GrapesJSProjectData | undefined);
      return {
        type: 'GUINoCodeDiagram' as const,
        index,
        diagram,
        applied: {
          keys: new Set(variants.map((v) => v.profileId)),
          names: new Set(variants.map((v) => v.profileName)),
        },
      };
    });
  }, [open, project]);

  const isApplied = (column: TargetColumn, profile: ProfileRow): boolean => {
    const key = column.type === 'AgentDiagram' ? profile.agentKey : profile.guiKey;
    return column.applied.keys.has(key) || column.applied.names.has(profile.name);
  };

  const goTo = useCallback(
    async (column: TargetColumn) => {
      onOpenChange(false);
      await dispatch(switchDiagramTypeThunk({ diagramType: column.type }));
      if ((project?.currentDiagramIndices?.[column.type] ?? 0) !== column.index) {
        await dispatch(switchDiagramIndexThunk({ diagramType: column.type, index: column.index }));
      }
      navigate('/');
    },
    [dispatch, navigate, onOpenChange, project],
  );

  const columns = [...agents, ...webUis];
  const noTargets = columns.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('personalizationOverview.title')}</DialogTitle>
          <DialogDescription>{t('personalizationOverview.description')}</DialogDescription>
        </DialogHeader>

        {/* Step 1 — user models */}
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <UserRound className="size-4" />
              {t('personalizationOverview.step1')}
            </h3>
            {onRecommend && profiles.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  onRecommend();
                }}
              >
                <Sparkles className="mr-1 size-3" />
                {t('recommendPersonalization.title')}
              </Button>
            )}
          </div>
          {profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('personalizationOverview.noProfiles')}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {profiles.map((profile) => (
                <li key={profile.agentKey} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{profile.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{profile.diagramTitle}</div>
                  </div>
                  <span
                    className={
                      profile.settingCount > 0
                        ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                        : 'rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                    }
                  >
                    {profile.settingCount > 0
                      ? t('personalizationOverview.settings', { count: profile.settingCount })
                      : t('personalizationOverview.noSettings')}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {profiles.some((p) => p.settingCount === 0) && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {t('personalizationOverview.noSettingsHint')}
            </p>
          )}
        </section>

        {/* Step 2 — defaults and what has been personalized */}
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Bot className="size-4" />
            <Globe className="size-4" />
            {t('personalizationOverview.step2')}
          </h3>
          {noTargets ? (
            <p className="text-sm text-muted-foreground">{t('personalizationOverview.noTargets')}</p>
          ) : (
            <div className="space-y-3">
              {columns.map((column) => (
                <div key={`${column.type}-${column.diagram.id}`} className="rounded-md border">
                  <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {column.type === 'AgentDiagram' ? (
                        <Bot className="size-4 shrink-0" />
                      ) : (
                        <Globe className="size-4 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{column.diagram.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {column.type === 'AgentDiagram'
                            ? t('personalizationOverview.defaultAgent')
                            : t('personalizationOverview.defaultWebUi')}
                        </div>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => void goTo(column)}>
                      {t('personalizationOverview.open')}
                    </Button>
                  </div>
                  {profiles.length === 0 ? null : (
                    <ul className="divide-y">
                      {profiles.map((profile) => {
                        const applied = isApplied(column, profile);
                        return (
                          <li
                            key={profile.agentKey}
                            className="flex items-center justify-between gap-3 px-3 py-2"
                          >
                            <div className="flex min-w-0 items-center gap-2 text-sm">
                              {applied ? (
                                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                              ) : (
                                <Circle className="size-4 shrink-0 text-muted-foreground" />
                              )}
                              <span className="truncate">{profile.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {applied
                                  ? t('personalizationOverview.applied')
                                  : t('personalizationOverview.notApplied')}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant={applied ? 'ghost' : 'outline'}
                              onClick={() => void goTo(column)}
                            >
                              {applied
                                ? t('personalizationOverview.reapply')
                                : t('personalizationOverview.personalize')}
                              <ArrowRight className="ml-1 size-3" />
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">{t('personalizationOverview.howTo')}</p>
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('personalizationOverview.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
