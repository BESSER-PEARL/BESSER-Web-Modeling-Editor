import { DiagramDTO } from 'shared';
import { Operation } from 'fast-json-patch';

/**
 * Service for storing and retrieving diagrams.
 */
export interface DiagramStorageService {
  /**
   * Saves given diagram with given token.
   * @param diagramDTO the diagram to save
   * @param token the token to save the diagram with
   */
  saveDiagram(diagramDTO: DiagramDTO, token: string): Promise<string>;

  /**
   * Updates the diagram with the given token with the given patch.
   * @param token the token of the diagram to update
   * @param patch the patch to apply to the diagram (in format of [JSONPatch](https://jsonpatch.com))
   */
  patchDiagram(token: string, patch: Operation[]): Promise<void>;

  /**
   * Returns a stored diagram by its token.
   * @param token the token of the diagram to retrieve
   */
  getDiagramByLink(token: string): Promise<DiagramDTO | undefined>;

  /**
   * Checks if a diagram with the given token exists.
   */
  diagramExists(token: string): Promise<boolean>;
}
