import { UMLModel } from '@besser/wme';

export class DiagramDTO {
  id: string;
  title: string;
  model: UMLModel;
  lastUpdate: string;
  versions?: DiagramDTO[];
  description?: string;
  token?: string;

  constructor(id: string, title: string, model: UMLModel, lastUpdate: string, versions: DiagramDTO[], token: string) {
    this.id = id;
    this.title = title;
    this.model = model;
    this.lastUpdate = lastUpdate;
    this.versions = versions;
    this.token = token;
  }
}
