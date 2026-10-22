import { toast } from 'react-toastify';

import i18n from '../../shared/i18n';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { getActiveDiagram } from '../../shared/types/project';
import type { BesserProject, ProjectDiagram } from '../../shared/types/project';

/**
 * The open project and its active Knowledge Graph diagram, which every KG flow
 * (preflight, refine, conversion) sends to the backend. Returns `null` and
 * shows a toast when there is no project or no KG diagram with a model.
 *
 * A plain function, not a hook, so the flows can call it at the moment they
 * run; it reads the i18n singleton, which is always the current language.
 */
export function getActiveKgDiagram(): { project: BesserProject; diagram: ProjectDiagram } | null {
  const project = ProjectStorageRepository.getCurrentProject() as BesserProject | null;
  if (!project) {
    toast.error(i18n.t('import.kg.toUml.noProject'));
    return null;
  }
  const diagram = getActiveDiagram(project, 'KnowledgeGraphDiagram');
  if (!diagram || !diagram.model) {
    toast.error(i18n.t('import.kg.toUml.noDiagram'));
    return null;
  }
  return { project, diagram };
}
