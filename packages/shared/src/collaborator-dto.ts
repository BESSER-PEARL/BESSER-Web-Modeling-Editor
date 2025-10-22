export interface CollaboratorType {
  color: string;
  name: string;
}

export class Collaborator implements CollaboratorType {
  constructor(
    public name: string,
    public color: string,
  ) {}
}
