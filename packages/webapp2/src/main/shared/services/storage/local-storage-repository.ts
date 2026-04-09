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
  localStorageSystemThemePreference,
  localStorageUserProfiles,
  localStorageUserThemePreference,
} from '../../constants/constant';
import { UMLModel } from '@besser/wme';
import { uuid } from '../../utils/uuid';
import { AgentConfigurationPayload } from '../../types/agent-config';

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

export const LocalStorageRepository = {
  setSystemThemePreference: (value: string) => {
    safeSetItem(localStorageSystemThemePreference, value);
  },

  setUserThemePreference: (value: string) => {
    safeSetItem(localStorageUserThemePreference, value);
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
};
