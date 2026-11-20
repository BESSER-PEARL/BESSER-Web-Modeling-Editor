/**
 * The local project that holds a change's class diagram: `lab-<changeId>`, named after the change and made
 * here, never by the project form. The lab build has no other project: the change view opens it, the Model
 * tab draws it, and a build of the change reads its model from it (`labChangeModelPayload`).
 */
import { UMLDiagramType, type UMLModel } from '@besser/wme';
import type { LabModelProposal, LabThreadItem } from '../../shared/api/lab';
import i18n from '../../shared/i18n';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { createDefaultProject, isUMLModel, type BesserProject } from '../../shared/types/project';

/** The id of change `changeId`'s project. */
export const labProjectId = (changeId: string): string => `lab-${changeId}`;

/** Change `changeId`'s project as this browser stores it, or null when it has none. */
export function loadLabProject(changeId: string): BesserProject | null {
  const id = labProjectId(changeId);
  // Asked for first: `loadProject` warns about a project it cannot find, which here is the ordinary case.
  return ProjectStorageRepository.getAllProjects().some((project) => project.id === id)
    ? ProjectStorageRepository.loadProject(id)
    : null;
}

/** Makes and stores change `changeId`'s project: named `title`, its class diagram open and empty. */
export function createLabProject(changeId: string, title: string, owner: string): BesserProject {
  const name = title || i18n.t('lab.change.newChange', { defaultValue: 'New change' });
  const project: BesserProject = {
    ...createDefaultProject(name, '', owner, undefined, undefined, 'ClassDiagram'),
    id: labProjectId(changeId),
  };
  ProjectStorageRepository.withoutNotify(() => ProjectStorageRepository.saveProject(project));
  return project;
}

/** Removes change `changeId`'s project from this browser (the change was dropped). */
export function deleteLabProject(changeId: string): void {
  if (loadLabProject(changeId)) ProjectStorageRepository.deleteProject(labProjectId(changeId));
}

/** The class diagram a change's thread holds: a plan's proposal, or the model a message carried. */
export type LabThreadModel =
  | { source: 'proposal'; at: number; proposal: LabModelProposal }
  | { source: 'message'; at: number; model: UMLModel };

const isClassDiagram = (model: unknown): model is UMLModel =>
  isUMLModel(model) && model.type === UMLDiagramType.ClassDiagram;

/**
 * The newest class diagram of a thread: the last plan's model proposal or the model the last message carried,
 * whichever came later; null when the thread holds neither. This rebuilds the canvas in a browser that has no
 * project of the change yet.
 */
export function latestThreadModel(thread: LabThreadItem[]): LabThreadModel | null {
  let proposal: LabThreadModel | null = null;
  let message: LabThreadModel | null = null;
  for (const item of thread) {
    if (item.type === 'run' && item.lab?.step === 'plan' && item.lab.modelProposal) {
      if (isClassDiagram(item.lab.modelProposal.model)) {
        proposal = { source: 'proposal', at: item.at, proposal: item.lab.modelProposal };
      } else {
        console.warn(`[lab] the plan of run ${item.runId} proposes a model that is not a class diagram; it is not drawn`);
      }
    } else if (item.type === 'message' && item.model) {
      if (isClassDiagram(item.model)) message = { source: 'message', at: item.at, model: item.model };
      else console.warn(`[lab] message ${item.id} carried a model that is not a class diagram; it is not drawn`);
    }
  }
  if (!proposal) return message;
  if (!message) return proposal;
  return message.at > proposal.at ? message : proposal;
}
