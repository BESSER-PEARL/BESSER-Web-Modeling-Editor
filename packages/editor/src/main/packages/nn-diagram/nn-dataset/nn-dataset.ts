import { NNElementType, NNRelationshipType } from '..';
import { UMLElementType } from '../../uml-element-type';
import { IUMLElement } from '../../../services/uml-element/uml-element';
import { DeepPartial } from 'redux';
import { NNBaseLayer } from '../nn-base-layer';

abstract class Dataset extends NNBaseLayer {
  constructor(values?: DeepPartial<Dataset>) {
    super(values);

    if (!values?.bounds) {
      this.bounds = { x: 0, y: 0, width: 0, height: 0 };
    }
    if (values?.ownedElements) {
      this.ownedElements = values.ownedElements.filter((id): id is string => id !== undefined);
    }
  }

  static supportedRelationships = [
    NNRelationshipType.NNAssociation,
  ];

  reorderChildren(children: IUMLElement[]): string[] {
    return children.filter((child) => child && child.id).map((child) => child.id);
  }
}

export class TrainingDataset extends Dataset {
  type: UMLElementType = NNElementType.TrainingDataset;

  constructor(values?: DeepPartial<TrainingDataset>) {
    super(values);
    if (!values?.name) {
      this.name = 'TrainingDataset';
    }
  }
}

export class TestDataset extends Dataset {
  type: UMLElementType = NNElementType.TestDataset;

  constructor(values?: DeepPartial<TestDataset>) {
    super(values);
    if (!values?.name) {
      this.name = 'TestDataset';
    }
  }
}