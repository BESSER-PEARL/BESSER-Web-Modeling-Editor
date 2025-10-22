import { applyPatch, Operation } from 'fast-json-patch';

import { FileStorageService } from '../storage-service/file-storage-service';
import { DiagramDTO } from 'shared';
import { diagramStoragePath } from '../../constants';
import { DiagramStorageService } from './diagram-storage-service';
import { DiagramStorageRateLimiter, DiagramStorageRequest } from './diagram-storage-rate-limiter';

type SaveRequest = DiagramStorageRequest & {
  path: string;
};

/**
 * Service for storing diagrams on the file system.
 * Requires `/diagrams` directory to be present in the working directory.
 */
export class DiagramFileStorageService implements DiagramStorageService {
  /**
   * How long should a substream for handling save requests of a particular
   * diagram be kept alive. Recommended value is larger that SAVE_INTERVAL.
   */
  static readonly SAVE_GROUP_TTL = 10_000;
  /**
   * How long should we wait for incoming save requests before saving the diagram.
   */
  static readonly SAVE_DEBOUNCE_TIME = 500;
  /**
   * How often should we save the diagram to ensure we don't lose data.
   * Saves might occur at a faster rate, this determines the maximum wait
   * between two saves (when there are save requests).
   */
  static readonly SAVE_INTERVAL = 3_000;

  /**
   * The file storage service to use for storing diagrams.
   */
  private fileStorageService: FileStorageService = new FileStorageService();

  /**
   * The rate limiter for saving diagrams.
   */
  private limiter: DiagramStorageRateLimiter<SaveRequest>;

  constructor() {
    this.limiter = new DiagramStorageRateLimiter<SaveRequest>(
      async (request) => {
        //
        // FIXME: this requires cancellation  mechanism on storage, which is not implemented yet.
        // read [this](https://stackoverflow.com/questions/74529131/node-js-how-to-cancel-a-writefile-operation)
        // to learn how to cancel a write operation.
        //
        await this.fileStorageService.saveContentToFile(request.path, JSON.stringify(request.diagramDTO));
      },
      async (request) => {
        //
        // FIXME: this requires cancellation  mechanism on storage, which is not implemented yet.
        // read [this](https://stackoverflow.com/questions/74529131/node-js-how-to-cancel-a-writefile-operation)
        // to learn how to cancel a write operation.
        //
        const diagram = await this.getDiagramByLink(request.token);
        diagram!.model = applyPatch(diagram!.model, request.patch).newDocument;
        await this.fileStorageService.saveContentToFile(request.path, JSON.stringify(diagram));
      },
      {
        saveInterval: DiagramFileStorageService.SAVE_INTERVAL,
        saveDebounceTime: DiagramFileStorageService.SAVE_DEBOUNCE_TIME,
        saveGroupTTL: DiagramFileStorageService.SAVE_GROUP_TTL,
      },
    );
  }

  async saveDiagram(diagramDTO: DiagramDTO, token: string, shared: boolean = true): Promise<string> {
    const path = this.getFilePathForToken(token);
    const exists = await this.diagramExists(path);

    if (exists && !shared) {
      throw Error(`File at ${path} already exists`);
    } else {
      if (exists) {
        this.limiter.request({ diagramDTO, token, path });
      } else {
        await this.fileStorageService.saveContentToFile(path, JSON.stringify(diagramDTO));
      }

      return token;
    }
  }

  async patchDiagram(token: string, patch: Operation[]): Promise<void> {
    const path = this.getFilePathForToken(token);
    const exists = await this.diagramExists(token);

    if (!exists) {
      throw Error(`File at ${path} does not exist`);
    } else {
      this.limiter.request({ patch, token, path });
    }
  }

  async diagramExists(token: string): Promise<boolean> {
    const path = this.getFilePathForToken(token);
    return this.fileStorageService.doesFileExist(path);
  }

  getDiagramByLink(token: string): Promise<DiagramDTO | undefined> {
    const path = this.getFilePathForToken(token);
    return this.fileStorageService.getFileContent(path).then((fileContent) => JSON.parse(fileContent) as DiagramDTO);
  }

  /**
   * Returns the file path for a diagram with given token.
   */
  private getFilePathForToken(token: string): string {
    return `${diagramStoragePath}/${token}.json`;
  }
}
