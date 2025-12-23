import { UMLDiagramType, UMLModel } from '@besser/wme';

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
