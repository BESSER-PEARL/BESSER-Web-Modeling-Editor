import { CollaboratorType, SelectionChangeType } from 'shared';
import { Patch } from '@besser/wme';
import { Diagram } from '../services/diagram/diagramSlice';

export type CollaborationMessage = {
  diagram?: Diagram;
  originator?: CollaboratorType;
  collaborators?: CollaboratorType[];
  patch?: Patch;
  selection?: SelectionChangeType;
};
