export interface SelectionChangeType {
  selected: string[];
  deselected: string[];
}

export class SelectionChange implements SelectionChangeType {
  constructor(
    public selected: string[],
    public deselected: string[],
  ) {}
}
