import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks';
import { selectActiveDiagram, selectWorkspaceLoading, bumpEditorRevision, refreshProjectStateThunk } from '../../../app/store/workspaceSlice';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { UMLDiagramType } from '@besser/wme';
import { isUMLModel } from '../../../shared/types/project';
import { ApiError, apiClient } from '../../../shared/api/api-client';
import { LocalStorageRepository } from '../../../shared/services/storage/local-storage-repository';
import { useProject } from '../../../app/hooks/useProject';
import type { StoredUserProfile, StoredAgentConfiguration } from '../../../shared/services/storage/local-storage-types';
import { aggregateProfilePersonalization } from '../../../shared/utils/personalization-aggregation';
import {
  splitUserDiagramIntoProfiles,
  mergeSingletonBoxes,
} from '../../../shared/utils/user-profile-graph';
import {
  type AgentModelVariantSnapshot,
  upsertVariantForProfile,
  readAgentVariants,
} from '../../../shared/services/agent-variants/agent-variants-service';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import type { UMLModel } from '@besser/wme';

interface PersonalizeAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** One selectable entry = one named User element from any UserDiagram. */
interface FlatProfileOption {
  /** Stable key: `${sourceTabId}::${rootBoxId}` */
  key: string;
  /** User element's `name` attribute — shown in the dropdown */
  userName: string;
  /** Tab title — shown when two users share the same name across tabs */
  tabName: string;
  /** Whether to show the tab name for disambiguation */
  showTab: boolean;
  /** Per-profile merged model ready for the backend */
  model: UMLModel;
  /** Source diagram, used when saving the mapping */
  sourceProfile: StoredUserProfile;
}

export const PersonalizeAgentDialog: React.FC<PersonalizeAgentDialogProps> = ({ open, onOpenChange }) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const activeAgentDiagram = useAppSelector(selectActiveDiagram);
  const { currentProject } = useProject();

  const [selectedKey, setSelectedKey] = useState<string>('');
  const [isApplying, setIsApplying] = useState(false);
  const workspaceLoading = useAppSelector(selectWorkspaceLoading);

  const availableProfiles = React.useMemo(() => {
    const results: FlatProfileOption[] = [];

    const addFromDiagram = (tabId: string, tabName: string, model: UMLModel) => {
      splitUserDiagramIntoProfiles(model).forEach((p) => {
        results.push({
          key: `${tabId}::${p.rootBoxId}`,
          userName: p.name,
          tabName,
          showTab: false, // filled in below after counting
          model: mergeSingletonBoxes(p.model),
          sourceProfile: { id: tabId, name: tabName, model, savedAt: new Date().toISOString() },
        });
      });
    };

    for (const profile of LocalStorageRepository.getUserProfiles()) {
      if (profile.model && isUMLModel(profile.model) && profile.model.type === UMLDiagramType.UserDiagram) {
        addFromDiagram(profile.id, profile.name, profile.model as UMLModel);
      }
    }

    for (const diagram of currentProject?.diagrams?.UserDiagram ?? []) {
      if (isUMLModel(diagram.model) && diagram.model.type === UMLDiagramType.UserDiagram) {
        addFromDiagram(diagram.id, diagram.title, diagram.model as UMLModel);
      }
    }

    // Mark entries whose user name appears more than once so the tab name is shown
    const nameCounts = new Map<string, number>();
    results.forEach((r) => nameCounts.set(r.userName, (nameCounts.get(r.userName) ?? 0) + 1));
    results.forEach((r) => { r.showTab = (nameCounts.get(r.userName) ?? 0) > 1; });

    return results;
  }, [currentProject]);

  const handleApply = useCallback(async () => {
    if (!selectedKey) {
      toast.error(t('personalize.selectProfile'));
      return;
    }

    if (!activeAgentDiagram || !isUMLModel(activeAgentDiagram.model)) {
      toast.error(t('personalize.noAgentDiagram'));
      return;
    }

    if (activeAgentDiagram.model.type !== UMLDiagramType.AgentDiagram) {
      toast.error(t('personalize.notAgentDiagram'));
      return;
    }

    const selected = availableProfiles.find((opt) => opt.key === selectedKey);
    if (!selected) {
      toast.error(t('personalize.profileNotFound'));
      return;
    }

    try {
      setIsApplying(true);

      const storedBase = LocalStorageRepository.getAgentBaseModel(activeAgentDiagram.id);
      const resolvedBase: UMLModel =
        storedBase && isUMLModel(storedBase) && storedBase.type === UMLDiagramType.AgentDiagram
          ? (storedBase as UMLModel)
          : (activeAgentDiagram.model as UMLModel);

      if (!storedBase && activeAgentDiagram.id) {
        LocalStorageRepository.saveAgentBaseModel(activeAgentDiagram.id, resolvedBase);
      }

      // Extract the flat agent config from the profile's per-element personalization
      // specs (language, modality, interface style, etc.), then attach the raw
      // user profile model so the backend's generate_user_profile_document can
      // build the full profile document — same structure the old "Save & Apply" sent.
      const { configuration } = aggregateProfilePersonalization(selected.model);
      const config: Record<string, any> = {
        ...configuration,
        userProfileModel: structuredClone(selected.model),
      };

      toast.info(t('personalize.applying'));

      const payload = {
        id: activeAgentDiagram.id,
        title: activeAgentDiagram.title,
        model: resolvedBase,
        lastUpdate: activeAgentDiagram.lastUpdate,
        generator: 'agent',
        config,
      };

      let transformedModel: unknown;
      try {
        transformedModel = await apiClient.post<unknown>(
          '/transform-agent-model-json',
          payload,
          { timeout: 600_000 },
        );
      } catch (err) {
        if (err instanceof ApiError) {
          toast.error(t('personalize.transformFailed', { message: err.message }));
          return;
        }
        if (err instanceof DOMException && err.name === 'TimeoutError') {
          toast.error(t('personalize.transformTimeout'));
          return;
        }
        throw err;
      }

      const snapshotModel: UMLModel | undefined =
        transformedModel && typeof transformedModel === 'object' && 'model' in transformedModel
          ? ((transformedModel as { model: UMLModel }).model)
          : (transformedModel as UMLModel | undefined);

      if (snapshotModel && currentProject) {
        const now = new Date().toISOString();
        const configId = `personalize_${Date.now()}`;
        const variantId = `${selected.sourceProfile.id}:${configId}`;

        const nextVariant: AgentModelVariantSnapshot = {
          id: variantId,
          profileId: selected.sourceProfile.id,
          profileName: selected.userName,
          configurationId: configId,
          configurationName: selected.userName,
          createdAt: now,
          model: snapshotModel,
        };

        // Find the current agent diagram index
        const agentIndex = currentProject.currentDiagramIndices?.AgentDiagram ?? 0;
        const latestProject =
          ProjectStorageRepository.loadProject(currentProject.id) ?? currentProject;
        const agentDiagram =
          latestProject.diagrams.AgentDiagram?.[agentIndex] ?? activeAgentDiagram;

        const existingVariants = readAgentVariants(agentDiagram);
        const updatedVariants = upsertVariantForProfile(existingVariants, nextVariant);

        ProjectStorageRepository.updateDiagram(
          currentProject.id,
          'AgentDiagram',
          {
            ...agentDiagram,
            model: structuredClone(snapshotModel),
            config: {
              ...(agentDiagram.config as Record<string, unknown> | undefined ?? {}),
              personalizedVariants: updatedVariants,
              activePersonalizedVariantId: variantId,
            },
          },
          agentIndex,
        );

        await dispatch(refreshProjectStateThunk()).unwrap();
        dispatch(bumpEditorRevision());

        // Also save the profile↔config mapping for the agent config panel
        const configEntry: StoredAgentConfiguration = {
          id: configId,
          name: selected.userName,
          savedAt: now,
          config: aggregateProfilePersonalization(selected.model).configuration as any,
          personalizedAgentModel: snapshotModel,
          originalAgentModel: resolvedBase,
        };
        LocalStorageRepository.saveAgentProfileConfigurationMapping(selected.sourceProfile, configEntry);
      }

      toast.success(t('personalize.success'));
      onOpenChange(false);
      setSelectedKey('');
    } catch (error) {
      console.error('Error personalizing agent:', error);
      toast.error(t('personalize.error'));
    } finally {
      setIsApplying(false);
    }
  }, [selectedKey, activeAgentDiagram, availableProfiles, dispatch, onOpenChange, t]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!isApplying) {
      onOpenChange(newOpen);
      if (!newOpen) setSelectedKey('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('personalize.title')}</DialogTitle>
          <DialogDescription>{t('personalize.description')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="profile-select">{t('personalize.selectProfile')}</Label>
            <Select
              value={selectedKey}
              onValueChange={setSelectedKey}
              disabled={isApplying || availableProfiles.length === 0}
            >
              <SelectTrigger id="profile-select">
                <SelectValue
                  placeholder={
                    availableProfiles.length === 0
                      ? t('personalize.noProfiles')
                      : t('personalize.selectProfilePlaceholder')
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableProfiles.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.userName || t('personalize.unnamedUser')}
                    {option.showTab ? ` — ${option.tabName}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isApplying}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={!selectedKey || isApplying || availableProfiles.length === 0 || workspaceLoading}
          >
            {isApplying ? t('personalize.applying') : t('personalize.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
