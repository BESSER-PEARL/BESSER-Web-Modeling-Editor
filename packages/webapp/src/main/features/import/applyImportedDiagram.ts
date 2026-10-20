// Pure helper shared by the assistant import hooks (KG + image): validate a
// backend diagram payload and apply it to a project, preserving the
// schemaVersion >= 2 invariant that `project.diagrams[type]` is always a
// `ProjectDiagram[]` array.
import { toast } from 'react-toastify';
import { uuid } from '../../shared/utils/uuid';
import {
  BesserProject,
  ProjectDiagram,
  SupportedDiagramType,
  isUMLModel,
  isV3UMLModel,
  toSupportedDiagramType,
} from '../../shared/types/project';
import { migrateUMLModelV3ToV4 } from '../../shared/services/storage/migrate-uml-v3-to-v4';

/** Shape of the backend's diagram-import responses (`/get-json-model-from-*`). */
export interface ImportedDiagramData {
  id?: string;
  title?: string;
  model: unknown;
  description?: string;
}

export interface ApplyImportedDiagramOptions {
  /** Title used when the backend response carries none (typically the file name). */
  fallbackTitle: string;
  /** Human-readable origin for messages, e.g. 'Knowledge Graph' or 'image'. */
  source: string;
}

export interface ApplyImportedDiagramResult {
  project: BesserProject;
  diagramType: SupportedDiagramType;
  diagramTitle: string;
}

/**
 * Apply an imported diagram payload to a project with
 * replace-at-active-index semantics (the v4 analogue of develop's
 * replace-the-single-diagram behavior):
 *
 * - the active entry of `project.diagrams[type]` is replaced in a copied
 *   array — never written as a bare object, which would clobber every other
 *   diagram of that type and break `getActiveDiagram`'s array indexing;
 * - when no diagram of that type exists yet, the import is pushed as the
 *   first entry (slot 0 — coherent with the `?? 0` active index);
 * - `currentDiagramIndices` keeps pointing at the replaced slot.
 *
 * Defense-in-depth: a v3-shape model ({elements, relationships}) is lifted
 * to v4 before validation so the flow still works against any backend that
 * emits v3 — the v4 model is what gets stored, never v3. Anything that is
 * not a valid v4 UMLModel after that is rejected with a toast + throw so
 * the user sees an error instead of a silently corrupted project.
 *
 * Pure with respect to its inputs: returns a new project object and never
 * touches storage or Redux — callers persist and reload themselves.
 */
export function applyImportedDiagramToProject(
  project: BesserProject,
  data: ImportedDiagramData,
  opts: ApplyImportedDiagramOptions,
): ApplyImportedDiagramResult {
  let model = data.model;
  if (isV3UMLModel(model)) {
    model = migrateUMLModelV3ToV4(model);
  }
  if (!isUMLModel(model)) {
    const msg = 'Imported model is not a valid v4 UMLModel (missing nodes/edges arrays).';
    toast.error(msg);
    throw new Error(msg);
  }

  const diagramType = toSupportedDiagramType(model.type);
  const newDiagram: ProjectDiagram = {
    id: uuid(),
    title: data.title || opts.fallbackTitle,
    model,
    lastUpdate: new Date().toISOString(),
    description: data.description || `Imported ${diagramType} diagram from ${opts.source}`,
  };

  // Update the active diagram in the array (preserving the array structure)
  const existingDiagrams = project.diagrams[diagramType] ?? [];
  const activeIndex = project.currentDiagramIndices?.[diagramType] ?? 0;
  const updatedDiagrams = [...existingDiagrams];

  if (updatedDiagrams.length === 0) {
    updatedDiagrams.push(newDiagram);
  } else {
    updatedDiagrams[Math.min(activeIndex, updatedDiagrams.length - 1)] = newDiagram;
  }

  return {
    project: {
      ...project,
      diagrams: {
        ...project.diagrams,
        [diagramType]: updatedDiagrams,
      },
    },
    diagramType,
    diagramTitle: newDiagram.title,
  };
}
