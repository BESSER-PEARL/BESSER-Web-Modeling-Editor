import {
  StoredAgentConfiguration,
  StoredAgentProfileConfigurationMapping,
  StoredUserProfile,
} from './local-storage-types';
import {
  localStorageAgentBaseModels,
  localStorageAgentConfigurations,
  localStorageAgentProfileMappings,
  localStorageActiveAgentConfiguration,
  localStorageDeployLinkedRepoPrefix,
  localStorageSystemConfig,
  localStorageSystemThemePreference,
  localStorageUserProfiles,
  localStorageUserThemePreference,
} from '../../constants/constant';
import { UMLModel } from '@besser/wme';
import { uuid } from '../../utils/uuid';
import type { AgentConfigurationPayload, AgentLLMProvider, IntentRecognitionTechnology } from '../../types/agent-config';

/**
 * Pre-prefix key retained for one-shot migration. All new keys MUST be defined
 * in ``shared/constants/constant.ts`` with the ``besser_`` prefix.
 */
const LEGACY_AGENT_CONFIG_KEY = 'agentConfig';

export interface SystemConfiguration {
  agentPlatform: string;
  intentRecognitionTechnology: IntentRecognitionTechnology;
  agentLlmProvider: AgentLLMProvider;
  agentLlmModel: string;
  agentCustomLlmModel: string;
}

export const DEFAULT_SYSTEM_CONFIGURATION: SystemConfiguration = {
  agentPlatform: 'streamlit',
  intentRecognitionTechnology: 'llm-based',
  agentLlmProvider: 'openai',
  agentLlmModel: 'gpt-5.5',
  agentCustomLlmModel: '',
};

const normalizeSystemConfig = (raw: Partial<SystemConfiguration> | null | undefined): SystemConfiguration => {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SYSTEM_CONFIGURATION };
  }
  const provider: AgentLLMProvider =
    raw.agentLlmProvider === 'openai' ||
    raw.agentLlmProvider === 'huggingface' ||
    raw.agentLlmProvider === 'huggingfaceapi' ||
    raw.agentLlmProvider === 'replicate'
      ? raw.agentLlmProvider
      : '';
  const intent: IntentRecognitionTechnology =
    raw.intentRecognitionTechnology === 'classical' ? 'classical' : 'llm-based';
  return {
    agentPlatform: typeof raw.agentPlatform === 'string' && raw.agentPlatform ? raw.agentPlatform : 'streamlit',
    intentRecognitionTechnology: intent,
    agentLlmProvider: provider,
    agentLlmModel: typeof raw.agentLlmModel === 'string' ? raw.agentLlmModel : '',
    agentCustomLlmModel: typeof raw.agentCustomLlmModel === 'string' ? raw.agentCustomLlmModel : '',
  };
};

type AgentBaseModelMap = Record<string, UMLModel>;

/**
 * Safely write to localStorage, catching QuotaExceededError so callers
 * can degrade gracefully instead of crashing.
 */
const safeSetItem = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.error(
        `[LocalStorageRepository] localStorage quota exceeded while writing key "${key}". ` +
        'Consider deleting unused projects or profiles to free space.',
      );
      // Don't rethrow — let caller handle gracefully
    } else {
      throw e;
    }
  }
};

const getStoredUserProfiles = (): StoredUserProfile[] => {
  const json = localStorage.getItem(localStorageUserProfiles);
  if (!json) {
    return [];
  }

  try {
    const parsed: StoredUserProfile[] = JSON.parse(json);
    return parsed.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  } catch (error) {
    console.warn('Failed to parse stored user profiles:', error);
    return [];
  }
};

const persistUserProfiles = (profiles: StoredUserProfile[]) => {
  safeSetItem(localStorageUserProfiles, JSON.stringify(profiles));
};

const getStoredAgentConfigurations = (): StoredAgentConfiguration[] => {
  const json = localStorage.getItem(localStorageAgentConfigurations);
  if (!json) {
    return [];
  }

  try {
    const parsed: StoredAgentConfiguration[] = JSON.parse(json);
    return parsed.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  } catch (error) {
    console.warn('Failed to parse stored agent configurations:', error);
    return [];
  }
};

const persistAgentConfigurations = (configs: StoredAgentConfiguration[]) => {
  safeSetItem(localStorageAgentConfigurations, JSON.stringify(configs));
};

const getStoredAgentProfileMappings = (): StoredAgentProfileConfigurationMapping[] => {
  const json = localStorage.getItem(localStorageAgentProfileMappings);
  if (!json) {
    return [];
  }

  try {
    const parsed: StoredAgentProfileConfigurationMapping[] = JSON.parse(json);
    return parsed.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  } catch (error) {
    console.warn('Failed to parse stored agent profile mappings:', error);
    return [];
  }
};

const persistAgentProfileMappings = (entries: StoredAgentProfileConfigurationMapping[]) => {
  safeSetItem(localStorageAgentProfileMappings, JSON.stringify(entries));
};

const getStoredAgentBaseModels = (): AgentBaseModelMap => {
  const json = localStorage.getItem(localStorageAgentBaseModels);
  if (!json) {
    return {};
  }

  try {
    return JSON.parse(json) as AgentBaseModelMap;
  } catch (error) {
    console.warn('Failed to parse stored agent base models:', error);
    return {};
  }
};

const persistAgentBaseModels = (entries: AgentBaseModelMap) => {
  safeSetItem(localStorageAgentBaseModels, JSON.stringify(entries));
};

export interface DeployLinkedRepo {
  owner: string;
  repo: string;
}

/**
 * Deploy-linked-repo storage uses a per-(project, target) key:
 *   ``besser_deploy_linked_<projectId>_<target>`` -> ``{ owner, repo }`` JSON.
 *
 * The two legacy fallback keys (``..._chatbot`` and the bare
 * ``besser_deploy_linked_<projectId>``) predate the explicit ``target``
 * suffix and are read transparently for backward compatibility.
 */
const deployLinkedRepoKey = (projectId: string, target: string): string =>
  `${localStorageDeployLinkedRepoPrefix}${projectId}_${target}`;

const legacyDeployLinkedRepoKey = (projectId: string, target: string): string | null => {
  if (target === 'agent') return `${localStorageDeployLinkedRepoPrefix}${projectId}_chatbot`;
  if (target === 'webapp') return `${localStorageDeployLinkedRepoPrefix}${projectId}`;
  return null;
};

const parseDeployLinkedRepo = (raw: string | null): DeployLinkedRepo | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.owner === 'string' && typeof parsed.repo === 'string') {
      return { owner: parsed.owner, repo: parsed.repo };
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * v2 -> v3: seed ``localStorageSystemConfig`` from the pre-projects-era
 * ``agentConfig`` flat key (if present), otherwise from defaults. Idempotent —
 * if ``localStorageSystemConfig`` already exists, the function no-ops.
 *
 * The legacy ``agentConfig`` key was already cleaned up by the v2 migration,
 * but this migration handles the (rare) case where v2 ran on an older browser
 * that still had the key, OR where a user hand-imported a settings export.
 */
const migrateToV3 = (): void => {
  if (localStorage.getItem(localStorageSystemConfig)) {
    return;
  }

  let legacyAgentLlmModel: string | null = null;
  try {
    const legacyJson = localStorage.getItem(LEGACY_AGENT_CONFIG_KEY);
    if (legacyJson) {
      const parsed = JSON.parse(legacyJson);
      if (parsed && typeof parsed.agentLlmModel === 'string' && parsed.agentLlmModel) {
        legacyAgentLlmModel = parsed.agentLlmModel;
      }
    }
  } catch {
    // ignore — fall through to defaults
  }

  const seeded: SystemConfiguration = {
    ...DEFAULT_SYSTEM_CONFIGURATION,
    agentLlmModel: legacyAgentLlmModel ?? DEFAULT_SYSTEM_CONFIGURATION.agentLlmModel,
  };
  safeSetItem(localStorageSystemConfig, JSON.stringify(seeded));
};

export const LocalStorageRepository = {
  setSystemThemePreference: (value: string) => {
    safeSetItem(localStorageSystemThemePreference, value);
  },

  setUserThemePreference: (value: string) => {
    safeSetItem(localStorageUserThemePreference, value);
  },

  getSystemConfiguration: (): SystemConfiguration => {
    const json = localStorage.getItem(localStorageSystemConfig);
    if (!json) {
      return { ...DEFAULT_SYSTEM_CONFIGURATION };
    }
    try {
      return normalizeSystemConfig(JSON.parse(json));
    } catch (error) {
      console.warn('Failed to parse stored system configuration:', error);
      return { ...DEFAULT_SYSTEM_CONFIGURATION };
    }
  },

  saveSystemConfiguration: (value: SystemConfiguration) => {
    safeSetItem(localStorageSystemConfig, JSON.stringify(normalizeSystemConfig(value)));
  },

  getSystemThemePreference: () => {
    return window.localStorage.getItem(localStorageSystemThemePreference);
  },

  getUserThemePreference: () => {
    return window.localStorage.getItem(localStorageUserThemePreference);
  },

  saveAgentBaseModel: (diagramId: string, model: UMLModel) => {
    if (!diagramId) {
      return;
    }

    const baseModels = getStoredAgentBaseModels();
    baseModels[diagramId] = JSON.parse(JSON.stringify(model));
    persistAgentBaseModels(baseModels);
  },

  getAgentBaseModel: (diagramId: string): UMLModel | null => {
    if (!diagramId) {
      return null;
    }

    const baseModels = getStoredAgentBaseModels();
    const stored = baseModels[diagramId];
    return stored ? (JSON.parse(JSON.stringify(stored)) as UMLModel) : null;
  },

  saveUserProfile: (name: string, model: UMLModel) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Profile name must not be empty');
    }

    const clone = JSON.parse(JSON.stringify(model));
    const savedAt = new Date().toISOString();
    const profiles = getStoredUserProfiles();

    const existingIndex = profiles.findIndex((profile) => profile.name.toLowerCase() === trimmedName.toLowerCase());
    const profile: StoredUserProfile = {
      id: existingIndex >= 0 ? profiles[existingIndex].id : uuid(),
      name: trimmedName,
      savedAt,
      model: clone,
    };

    if (existingIndex >= 0) {
      profiles[existingIndex] = profile;
    } else {
      profiles.push(profile);
    }

    persistUserProfiles(profiles);
    return profile;
  },

  getUserProfiles: (): StoredUserProfile[] => {
    return getStoredUserProfiles();
  },

  loadUserProfile: (id: string): StoredUserProfile | null => {
    const profiles = getStoredUserProfiles();
    const profile = profiles.find((entry) => entry.id === id);
    return profile || null;
  },

  saveAgentConfiguration: (
    name: string,
    config: AgentConfigurationPayload,
    options?: { personalizedAgentModel?: UMLModel | null; originalAgentModel?: UMLModel | null },
  ) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Configuration name must not be empty');
    }

    const clone = JSON.parse(JSON.stringify(config)) as AgentConfigurationPayload;
    const personalizedSnapshot = options?.personalizedAgentModel
      ? (JSON.parse(JSON.stringify(options.personalizedAgentModel)) as UMLModel)
      : null;
    const originalSnapshot = options?.originalAgentModel
      ? (JSON.parse(JSON.stringify(options.originalAgentModel)) as UMLModel)
      : null;
    const savedAt = new Date().toISOString();
    const configs = getStoredAgentConfigurations();

    const existingIndex = configs.findIndex((entry) => entry.name.toLowerCase() === trimmedName.toLowerCase());
    const storedEntry: StoredAgentConfiguration = {
      id: existingIndex >= 0 ? configs[existingIndex].id : uuid(),
      name: trimmedName,
      savedAt,
      config: clone,
      baseAgentModel: originalSnapshot,
      personalizedAgentModel: personalizedSnapshot,
      originalAgentModel: originalSnapshot,
    };

    if (existingIndex >= 0) {
      configs[existingIndex] = storedEntry;
    } else {
      configs.push(storedEntry);
    }

    persistAgentConfigurations(configs);
    return storedEntry;
  },

  getAgentConfigurations: (): StoredAgentConfiguration[] => {
    return getStoredAgentConfigurations();
  },

  /**
   * Legacy pre-projects-era key (``'agentConfig'``, without the ``besser_``
   * prefix) — still read at startup so existing users' settings don't silently
   * disappear. Paired with ``clearLegacyAgentConfig`` which is called once the
   * value has been migrated into the new per-project storage.
   */
  getLegacyAgentConfig: (): string | null => {
    return localStorage.getItem(LEGACY_AGENT_CONFIG_KEY);
  },

  clearLegacyAgentConfig: () => {
    localStorage.removeItem(LEGACY_AGENT_CONFIG_KEY);
  },

  loadAgentConfiguration: (id: string): StoredAgentConfiguration | null => {
    const configs = getStoredAgentConfigurations();
    return configs.find((entry) => entry.id === id) || null;
  },

  deleteAgentConfiguration: (id: string) => {
    const configs = getStoredAgentConfigurations().filter((entry) => entry.id !== id);
    persistAgentConfigurations(configs);
  },

  setActiveAgentConfigurationId: (id: string) => {
    safeSetItem(localStorageActiveAgentConfiguration, id);
  },

  getActiveAgentConfigurationId: (): string | null => {
    return localStorage.getItem(localStorageActiveAgentConfiguration);
  },

  clearActiveAgentConfigurationId: () => {
    localStorage.removeItem(localStorageActiveAgentConfiguration);
  },

  saveAgentProfileConfigurationMapping: (profile: StoredUserProfile, config: StoredAgentConfiguration) => {
    const mappings = getStoredAgentProfileMappings();
    const savedAt = new Date().toISOString();
    const existingIndex = mappings.findIndex((entry) => entry.userProfileId === profile.id);

    const mapping: StoredAgentProfileConfigurationMapping = {
      id: existingIndex >= 0 ? mappings[existingIndex].id : uuid(),
      userProfileId: profile.id,
      userProfileName: profile.name,
      agentConfigurationId: config.id,
      agentConfigurationName: config.name,
      savedAt,
    };

    if (existingIndex >= 0) {
      mappings[existingIndex] = mapping;
    } else {
      mappings.push(mapping);
    }

    persistAgentProfileMappings(mappings);
    return mapping;
  },

  getAgentProfileConfigurationMappings: (): StoredAgentProfileConfigurationMapping[] => {
    return getStoredAgentProfileMappings();
  },

  deleteAgentProfileConfigurationMapping: (id: string) => {
    const mappings = getStoredAgentProfileMappings().filter((entry) => entry.id !== id);
    persistAgentProfileMappings(mappings);
  },

  /**
   * Deploy-linked-repo lookup with two layers of legacy fallbacks:
   *   1. ``besser_deploy_linked_<projectId>_<target>`` (current shape)
   *   2. ``besser_deploy_linked_<projectId>_chatbot`` for ``target === 'agent'``
   *      (the agent target was renamed from "chatbot")
   *   3. ``besser_deploy_linked_<projectId>`` (no suffix) for
   *      ``target === 'webapp'`` (the suffix was added later)
   */
  getDeployLinkedRepo: (projectId: string, target: string): DeployLinkedRepo | null => {
    const direct = parseDeployLinkedRepo(localStorage.getItem(deployLinkedRepoKey(projectId, target)));
    if (direct) return direct;
    const legacyKey = legacyDeployLinkedRepoKey(projectId, target);
    if (legacyKey) {
      return parseDeployLinkedRepo(localStorage.getItem(legacyKey));
    }
    return null;
  },

  setDeployLinkedRepo: (projectId: string, target: string, value: DeployLinkedRepo): void => {
    safeSetItem(deployLinkedRepoKey(projectId, target), JSON.stringify(value));
  },

  clearDeployLinkedRepo: (projectId: string, target: string): void => {
    localStorage.removeItem(deployLinkedRepoKey(projectId, target));
    const legacyKey = legacyDeployLinkedRepoKey(projectId, target);
    if (legacyKey) {
      localStorage.removeItem(legacyKey);
    }
  },

  /**
   * One-shot v2 -> v3 migration hook. Call once at startup from the global
   * storage-migration runner (see ``shared/utils/storage-migration.ts``).
   * Idempotent — safe to invoke on every boot.
   */
  migrateToV3,
};
