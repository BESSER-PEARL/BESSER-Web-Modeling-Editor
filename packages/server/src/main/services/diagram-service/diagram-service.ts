import { randomString } from '../../utils';
import { tokenLength } from '../../constants';
import { DiagramStorageService } from '../diagram-storage/diagram-storage-service';
import { DiagramDTO } from 'shared';

export class DiagramService {
  private storageService: DiagramStorageService;

  constructor(storageService: DiagramStorageService) {
    this.storageService = storageService;
  }

  async saveDiagramVersion(
    diagramDTO: DiagramDTO,
    existingToken?: string,
  ): Promise<{ diagramToken: string; diagram: DiagramDTO }> {
    const diagramExists = existingToken !== undefined && (await this.storageService.diagramExists(existingToken));
    const diagramToken = diagramExists ? existingToken : randomString(tokenLength);
    const diagram = !diagramExists ? diagramDTO : await this.getDiagramByLink(diagramToken);
    const model = diagramDTO.model;
    const title = diagramDTO.title;
    const description = diagramDTO.description;

    if (!diagram) {
      throw Error(`Could not retrieve a saved diagram with the token ${diagramToken}`);
    }

    if (!diagram.versions) {
      diagram.versions = [];
    }

    diagram.model = model;
    diagram.token = diagramToken;
    diagram.title = title;
    diagram.description = description;

    const newDiagramVersion = {
      ...diagramDTO,
      lastUpdate: new Date().toISOString(),
    };
    // Remove token and versions fields from newDiagramVersion
    delete newDiagramVersion.token;
    delete newDiagramVersion.versions;

    diagram.versions.push(newDiagramVersion);
    await this.storageService.saveDiagram(diagram, diagramToken);

    return { diagramToken, diagram };
  }

  async deleteDiagramVersion(token: string, versionIndex: number): Promise<DiagramDTO> {
    const diagram = await this.getDiagramByLink(token);

    if (!diagram) {
      throw Error(`Could not retrieve a saved diagram with the token ${token}`);
    }

    if (!diagram.versions) {
      throw Error(`Diagram with the token ${token} doesn't have any versions`);
    }

    diagram.versions.splice(versionIndex, 1);
    await this.storageService.saveDiagram(diagram, token);

    return diagram;
  }

  async editDiagramVersion(
    token: string,
    versionIndex: number,
    title: string,
    description: string,
  ): Promise<DiagramDTO> {
    const diagram = await this.getDiagramByLink(token);

    if (!diagram) {
      throw Error(`Could not retrieve a saved diagram with the token ${token}`);
    }

    if (!diagram.versions) {
      throw Error(`Diagram with the token ${token} doesn't have any versions`);
    }

    diagram.versions[versionIndex].title = title;
    diagram.versions[versionIndex].description = description;
    await this.storageService.saveDiagram(diagram, token);

    return diagram;
  }

  getDiagramByLink(token: string): Promise<DiagramDTO | undefined> {
    return this.storageService.getDiagramByLink(token);
  }
}
