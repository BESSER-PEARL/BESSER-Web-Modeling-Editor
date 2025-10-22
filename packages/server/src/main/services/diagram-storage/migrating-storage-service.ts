import { Operation } from 'fast-json-patch';
import { DiagramDTO } from 'shared/src/diagram-dto';
import { DiagramStorageService } from './diagram-storage-service';


/**
 * Options for a migrating storage service.
 */
export interface MigratingStorageOptions {
  /**
   * The storage service to migrate to.
   * - New diagrams will be stored in this storage.
   * - Loading old diagrams will cause them to be saved in this storage.
   * - Updates to old diagrams are applied to this storage.
   */
  targetStorage: DiagramStorageService;

  /**
   * The storage service to load old diagrams from.
   * - If a diagram is loaded from this storage and updated,
   *   the changes WILL NOT be saved in this storage.
   */
  sourceStorage: DiagramStorageService;
}


/**
 * Storage service that migrates diagrams between two storage services.
 * This class allows for migrating from one diagram storage backend to another
 * in a slow rollout, and without any downtime, assuming both storage backends
 * are available during the migration.
 * 
 * - New diagrams are stored solely in the target storage.
 * - Upon loading diagrams from the old storage, they are also stored in target storage.
 * - Updates are only applied to target storage, so diagrams in the source storage
 *   will slowly become outdated.
 */
export class MigratingStorageService implements DiagramStorageService {
  constructor(readonly options: MigratingStorageOptions) {}

  async saveDiagram(diagramDTO: DiagramDTO, token: string) {
    return this.options.targetStorage.saveDiagram(diagramDTO, token);
  }

  async patchDiagram(token: string, patch: Operation[]) {
    await this.options.targetStorage.patchDiagram(token, patch);
  }

  async diagramExists(token: string) {
    return await this.options.targetStorage.diagramExists(token)
      || await this.options.sourceStorage.diagramExists(token);
  }

  async getDiagramByLink(token: string) {
    if (await this.options.targetStorage.diagramExists(token)) {
      return await this.options.targetStorage.getDiagramByLink(token);
    } else {
      const dto = await this.options.sourceStorage.getDiagramByLink(token);
      dto && await this.options.targetStorage.saveDiagram(dto, token);

      return dto;
    }
  }
}
