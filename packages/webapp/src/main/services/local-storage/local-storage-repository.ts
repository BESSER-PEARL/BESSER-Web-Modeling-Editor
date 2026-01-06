import { LocalStorageDiagramListItem, StoredAgentConfiguration, StoredAgentProfileConfigurationMapping, StoredUserProfile } from './local-storage-types';
import {
  localStorageCollaborationColor,
  localStorageCollaborationName,
  localStorageDiagramPrefix,
  localStorageDiagramsList,
  localStorageLatest,
  localStorageSystemThemePreference,
  localStorageUserThemePreference,
  localStorageUserProfiles,
  localStorageAgentConfigurations,
  localStorageAgentProfileMappings,
  localStorageActiveAgentConfiguration,
  localStorageAgentBaseModels,
} from '../../constant';
import { Diagram } from '../diagram/diagramSlice';
import { UMLDiagramType, UMLModel } from '@besser/wme';
import { isUMLModel } from '../../types/project';
import { uuid } from '../../utils/uuid';
import { AgentConfigurationPayload } from '../../types/agent-config';

type LocalDiagramEntry = {
  id: string;
  title: string;
  type: UMLDiagramType;
  lastUpdate: string;
};

type AgentBaseModelMap = Record<string, UMLModel>;

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
  localStorage.setItem(localStorageUserProfiles, JSON.stringify(profiles));
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
  localStorage.setItem(localStorageAgentConfigurations, JSON.stringify(configs));
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
  localStorage.setItem(localStorageAgentProfileMappings, JSON.stringify(entries));
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
  localStorage.setItem(localStorageAgentBaseModels, JSON.stringify(entries));
};

export const LocalStorageRepository = {
  storeDiagram: (diagram: Diagram) => {
    localStorage.setItem(localStorageDiagramPrefix + diagram.id, JSON.stringify(diagram));
    localStorage.setItem(localStorageLatest, diagram.id);

    const localDiagramEntry: LocalDiagramEntry = {
      id: diagram.id,
      title: diagram.title,
      type: isUMLModel(diagram.model) ? diagram.model.type : UMLDiagramType.ClassDiagram,
      lastUpdate: new Date().toISOString(),
    };

    const localStorageListJson = localStorage.getItem(localStorageDiagramsList);
    let localDiagrams: LocalDiagramEntry[] = localStorageListJson ? JSON.parse(localStorageListJson) : [];

    localDiagrams = localDiagrams.filter((entry) => entry.id !== diagram.id);
    localDiagrams.push(localDiagramEntry);

    localStorage.setItem(localStorageDiagramsList, JSON.stringify(localDiagrams));
  },

  getStoredDiagrams: () => {
    const localStorageDiagramList = window.localStorage.getItem(localStorageDiagramsList);
    let localDiagrams: LocalStorageDiagramListItem[] = [];
    if (localStorageDiagramList) {
      localDiagrams = JSON.parse(localStorageDiagramList);
      localDiagrams.sort(
        (first: LocalStorageDiagramListItem, second: LocalStorageDiagramListItem) =>
          (new Date(first.lastUpdate).getTime() - new Date(second.lastUpdate).getTime()) * -1,
      );
    }
    return localDiagrams;
  },

  setCollaborationName: (name: string) => {
    window.localStorage.setItem(localStorageCollaborationName, name);
  },

  setCollaborationColor: (color: string) => {
    window.localStorage.setItem(localStorageCollaborationColor, color);
  },

  setLastPublishedToken: (token: string) => {
    window.localStorage.setItem('last_published_token', token);
  },

  getLastPublishedToken: () => {
    return window.localStorage.getItem('last_published_token');
  },

  setLastPublishedType: (type: string) => {
    window.localStorage.setItem('last_published_type', type);
  },

  getLastPublishedType: () => {
    return window.localStorage.getItem('last_published_type');
  },

  setSystemThemePreference: (value: string) => {
    window.localStorage.setItem(localStorageSystemThemePreference, value);
  },

  setUserThemePreference: (value: string) => {
    window.localStorage.setItem(localStorageUserThemePreference, value);
  },

  getSystemThemePreference: () => {
    return window.localStorage.getItem(localStorageSystemThemePreference);
  },

  getUserThemePreference: () => {
    return window.localStorage.getItem(localStorageUserThemePreference);
  },

  removeUserThemePreference: () => {
    window.localStorage.removeItem(localStorageUserThemePreference);
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

  removeAgentBaseModel: (diagramId: string) => {
    if (!diagramId) {
      return;
    }

    const baseModels = getStoredAgentBaseModels();
    if (!(diagramId in baseModels)) {
      return;
    }

    delete baseModels[diagramId];
    persistAgentBaseModels(baseModels);
  },

  storeDiagramByType: (type: UMLDiagramType, diagram: Diagram) => {
    const key = `${localStorageDiagramPrefix}type_${type}`;
    localStorage.setItem(key, JSON.stringify(diagram));
  },

  loadDiagramByType: (type: UMLDiagramType): Diagram | null => {
    const key = `${localStorageDiagramPrefix}type_${type}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
    return null;
  },

  removeDiagramByType: (type: UMLDiagramType) => {
    const key = `${localStorageDiagramPrefix}type_${type}`;
    localStorage.removeItem(key);
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

  deleteUserProfile: (id: string) => {
    const profiles = getStoredUserProfiles().filter((profile) => profile.id !== id);
    persistUserProfiles(profiles);
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
      baseAgentModel: personalizedSnapshot,
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
    localStorage.setItem(localStorageActiveAgentConfiguration, id);
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

