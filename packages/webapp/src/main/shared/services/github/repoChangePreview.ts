/** What is new on a linked branch, read and drawn ahead of taking it in. Writes nothing. */
import { BesserEditor, sanitizeSvg, type UMLModel } from '@besser/wme';
import { ApiError } from '../../api/api-client';
import { loadModelAtCommit } from '../../api/github';
import { readRepoProject } from '../project-import/projectImport';
import type { BesserProject } from '../../types/project';
import { classModelElements, elementLabel, type ClassModelElement } from './modelAttribution';
import { diffClassModels, idsToDraw, incomingMarks, type ModelChanges } from './modelChanges';
import { elementBounds, memberBounds, relationshipPoints, type Bounds } from './modelGeometry';

// The canvas holds the same ids: `url(#id)` would resolve to its clip, cutting off a new row.
const DRAWING_ID_PREFIX = 'repo-preview-';

export type { Bounds };

export interface RepoChangePreviewData {
  changes: ModelChanges;
  head: BesserProject;
  /** Every element of the head, for labels. */
  elements: Map<string, ClassModelElement>;
  removedLabels: Map<string, string>;
  /** The new and changed classes as the editor draws them, and where in model coordinates. */
  drawing: { svg: string; clip: Bounds } | null;
  drawnClasses: { id: string; bounds: Bounds; whole: boolean }[];
  /** The new and changed rows of classes that are otherwise as they were. */
  drawnRows: { id: string; bounds: Bounds }[];
  /** The new relationships, as points in model coordinates. */
  drawnRelationships: { id: string; points: { x: number; y: number }[] }[];
}

const diagramModel = (project: BesserProject | null, diagramId: string | undefined) =>
  project?.diagrams?.ClassDiagram?.find((diagram) => diagram.id === diagramId)?.model as unknown;

export async function loadRepoChangePreview(
  session: string,
  target: { owner: string; repo: string; headSha: string; baseSha?: string; modelPath?: string },
  activeDiagramId: string | undefined,
): Promise<RepoChangePreviewData> {
  const { owner, repo, headSha, baseSha, modelPath } = target;
  const [headVersion, baseVersion] = await Promise.all([
    loadModelAtCommit(session, owner, repo, headSha, modelPath),
    // Only a commit that held no model reads as empty: any other failure must not make everything look new.
    baseSha
      ? loadModelAtCommit(session, owner, repo, baseSha, modelPath).catch((error: unknown) => {
          if (error instanceof ApiError && error.status === 404) return null;
          throw error;
        })
      : null,
  ]);
  const head = readRepoProject(headVersion.project);
  const base = baseVersion ? readRepoProject(baseVersion.project) : null;
  const changes = diffClassModels(base, head);
  const headModel = diagramModel(head, activeDiagramId);

  const include = idsToDraw(changes, diagramModel(base, activeDiagramId), headModel);
  let drawing: RepoChangePreviewData['drawing'] = null;
  if (include.length && headModel) {
    try {
      const { svg, clip } = await BesserEditor.exportModelAsSvg(headModel as UMLModel, { include, margin: 0 });
      drawing = { svg: sanitizeSvg(svg, DRAWING_ID_PREFIX), clip };
    } catch (error) {
      // The bar still says what changed.
      console.warn('Could not draw the incoming classes', error);
    }
  }
  const before = base ? classModelElements(base) : new Map<string, ClassModelElement>();
  const { wholeClasses, rows } = incomingMarks(changes);
  return {
    changes,
    head,
    elements: classModelElements(head),
    removedLabels: new Map(changes.removed.map((element) => [element.id, elementLabel(element, before)])),
    drawing,
    drawnClasses: include.flatMap((id) => {
      const bounds = headModel ? elementBounds(headModel, id) : null;
      return bounds ? [{ id, bounds, whole: wholeClasses.has(id) }] : [];
    }),
    drawnRows: rows.flatMap(({ id }) => {
      const bounds = headModel ? memberBounds(headModel, id) : null;
      return bounds ? [{ id, bounds }] : [];
    }),
    drawnRelationships: changes.addedRelationships.flatMap(({ id }) => {
      const points = headModel ? relationshipPoints(headModel, id) : null;
      return points ? [{ id, points }] : [];
    }),
  };
}
