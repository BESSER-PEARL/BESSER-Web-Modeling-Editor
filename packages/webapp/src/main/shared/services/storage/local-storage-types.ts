import { UMLDiagramType, UMLModel } from '@besser/wme';
import { AgentConfigurationPayload } from '../../types/agent-config';

export type LocalStorageDiagramListItem = {
  id: string;
  title: string;
  type: UMLDiagramType;
  lastUpdate: string;
};

export type StoredUserProfile = {
  id: string;
  name: string;
  savedAt: string;
  model: UMLModel;
};

export type StoredAgentConfiguration = {
  id: string;
  name: string;
  savedAt: string;
  config: AgentConfigurationPayload;
  baseAgentModel?: UMLModel | null;
  personalizedAgentModel?: UMLModel | null;
  originalAgentModel?: UMLModel | null;
};

export type StoredAgentProfileConfigurationMapping = {
  id: string;
  userProfileId: string;
  userProfileName: string;
  agentConfigurationId: string;
  agentConfigurationName: string;
  savedAt: string;
};
