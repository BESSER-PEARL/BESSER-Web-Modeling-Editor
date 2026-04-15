import { Component, ComponentClass } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import { ModelState } from '../../../components/store/model-state';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { NNElementType, NNRelationshipType } from '../index';
import { UMLRelationship } from '../../../services/uml-relationship/uml-relationship';
import { INNAttribute } from '../nn-component-attribute';

type StateProps = {
  elements: ModelState['elements'];
};

type DispatchProps = {
  delete: typeof UMLElementRepository.delete;
  update: typeof UMLElementRepository.update;
};

type Props = StateProps & DispatchProps;

class NNAssociationMonitorComponent extends Component<Props> {
  componentDidMount() {
    this.checkAndUpdateAssociations();
  }

  componentDidUpdate(prevProps: Readonly<Props>) {
    if (prevProps.elements !== this.props.elements) {
      this.checkAndUpdateAssociations();
      this.renameNewDuplicateNameAttributes(prevProps.elements);
    }
  }

  private checkAndUpdateAssociations() {
    const { elements } = this.props;

    Object.values(elements).forEach((element: any) => {
      if (!UMLRelationship.isUMLRelationship(element)) return;

      // Delete any NNNext connection involving NNContainer or Configuration
      if (element.type === NNRelationshipType.NNNext) {
        const source = elements[element.source?.element];
        const target = elements[element.target?.element];
        const isInvalid =
          source?.type === NNElementType.NNContainer ||
          source?.type === NNElementType.Configuration ||
          target?.type === NNElementType.NNContainer ||
          target?.type === NNElementType.Configuration;
        if (isInvalid) {
          this.props.delete(element.id);
          return;
        }
      }
    });
  }

  private renameNewDuplicateNameAttributes(prevElements: ModelState['elements']) {
    const { elements } = this.props;

    // --- Handle layer name attributes (attributeName === 'name') ---
    const newNameAttrs = Object.values(elements).filter(
      (el) => !prevElements[el.id] && (el as INNAttribute).attributeName === 'name'
    );

    if (newNameAttrs.length > 0) {
      const takenNames = new Set<string>(
        Object.values(prevElements)
          .filter((el) => (el as INNAttribute).attributeName === 'name')
          .map((el) => (el as INNAttribute).value)
      );

      for (const attr of newNameAttrs) {
        const baseName = (attr as INNAttribute).value;
        let uniqueName = baseName;
        let counter = 2;
        while (takenNames.has(uniqueName)) {
          uniqueName = `${baseName}${counter}`;
          counter++;
        }
        takenNames.add(uniqueName);

        if (uniqueName !== baseName) {
          this.props.update(attr.id, { value: uniqueName, name: `name = ${uniqueName}` } as Partial<INNAttribute>);
        }
      }
    }

    // --- Handle NNContainer elements (name stored directly on the element) ---
    const newContainers = Object.values(elements).filter(
      (el) => !prevElements[el.id] && el.type === NNElementType.NNContainer
    );

    if (newContainers.length > 0) {
      const takenContainerNames = new Set<string>(
        Object.values(prevElements)
          .filter((el) => el.type === NNElementType.NNContainer)
          .map((el) => el.name)
      );

      for (const container of newContainers) {
        const baseName = container.name;
        let uniqueName = baseName;
        let counter = 2;
        while (takenContainerNames.has(uniqueName)) {
          uniqueName = `${baseName}${counter}`;
          counter++;
        }
        takenContainerNames.add(uniqueName);

        if (uniqueName !== baseName) {
          this.props.update(container.id, { name: uniqueName });
        }
      }
    }
  }

  render() {
    return null;
  }
}

const enhance = compose<ComponentClass>(
  connect<StateProps, DispatchProps, {}, ModelState>(
    (state) => ({
      elements: state.elements,
    }),
    {
      delete: UMLElementRepository.delete,
      update: UMLElementRepository.update,
    }
  )
);

export const NNAssociationMonitor = enhance(NNAssociationMonitorComponent);