export { DiagramStorageService } from './diagram-storage-service';

import { DiagramStorageService } from './diagram-storage-service';
import { DiagramRedisStorageService } from './diagram-redis-storage-service';
import { DiagramFileStorageService } from './diagram-file-storage-service';
import { MigratingStorageService } from './migrating-storage-service';

/**
 * Factory for creating a diagram storage service. Will determine
 * the correct service to use based on the environment.
 */
export class DiagramStorageFactory {
  private static storageService?: DiagramStorageService;

  private static createStorageService(): DiagramStorageService {
    if (process.env.APOLLON_REDIS_URL !== undefined) {

      const redisStorage = new DiagramRedisStorageService({
        url: process.env.APOLLON_REDIS_URL,
        ttl: process.env.APOLLON_REDIS_DIAGRAM_TTL,
      });

      if (process.env.APOLLON_REDIS_MIGRATE_FROM_FILE !== undefined) {
        return new MigratingStorageService({
          targetStorage: redisStorage,
          sourceStorage: new DiagramFileStorageService(),
        });
      } else {
        return redisStorage;
      }
    } else {
      return new DiagramFileStorageService();
    }
  }

  /**
   * Returns the instance for diagram storage service.
   * - If the environment variable `APOLLON_REDIS_URL` is set, it will return a `DiagramRedisStorageService`.
   * - Otherwise, it will return a `DiagramFileStorageService`, which requires `/diagrams` directory to be present.
   */
  public static getStorageService(): DiagramStorageService {
    if (this.storageService === undefined) {
      this.storageService = this.createStorageService();
    }
    return this.storageService;
  }
}
