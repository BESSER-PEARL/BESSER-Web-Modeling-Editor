import { Component, ComponentClass } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import { ModelState } from '../../../components/store/model-state';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { NNElementType, NNRelationshipType } from '../index';
import { UMLRelationship } from '../../../services/uml-relationship/uml-relationship';
import { UMLDiagramType } from '../../diagram-type';
import { INNAttribute } from '../nn-component-attribute';

type StateProps = {
  elements: ModelState['elements'];
  diagramType: string | undefined;
};

type DispatchProps = {
  delete: typeof UMLElementRepository.delete;
  update: typeof UMLElementRepository.update;
};

type Props = StateProps & DispatchProps;

class NNAssociationMonitorComponent extends Component<Props> {
  componentDidMount() {
    if (!this.isActive()) return;
    this.checkAndUpdateAssociations();
  }

  componentDidUpdate(prevProps: Readonly<Props>) {
    if (!this.isActive()) return;
    if (prevProps.elements !== this.props.elements) {
      this.checkAndUpdateAssociations();
      this.renameNewDuplicateNameAttributes(prevProps.elements);
      this.propagateContainerRenames(prevProps.elements);
      this.enforceConfigurationSingleton(prevProps.elements);
      this.cleanupHiddenOptionalAttributes();
    }
  }

  /**
   * The NN metamodel allows at most one Configuration per NN. Dropping a
   * second Configuration element produces a diagram that fails backend
   * validation. Detect any NNContainer that has more than one Configuration
   * child, delete the newest one, and let the older instance remain.
   */
  private enforceConfigurationSingleton(prevElements: ModelState['elements']) {
    const { elements } = this.props;
    const byContainer: Record<string, string[]> = {};
    for (const el of Object.values(elements)) {
      if (el.type !== NNElementType.Configuration) continue;
      const owner = (el as any).owner;
      if (!owner) continue;
      (byContainer[owner] = byContainer[owner] || []).push(el.id);
    }
    for (const [_owner, configIds] of Object.entries(byContainer)) {
      if (configIds.length <= 1) continue;
      // Prefer keeping any Configuration that existed before this update,
      // so a drag-drop that creates a duplicate removes only the fresh one.
      const newlyAdded = configIds.filter(id => !prevElements[id]);
      const toDelete = newlyAdded.length > 0 ? newlyAdded : configIds.slice(1);
      for (const id of toDelete) {
        this.props.delete(id);
      }
    }
  }

  /**
   * NNReference.referencedNN stores the target NNContainer's name (not its id).
   * When the user renames a container, every reference pointing at the old
   * name becomes stale and can't resolve on the backend. Diff prev vs current
   * for NNContainer name changes and rewrite matching ``referencedNN`` (and
   * display ``name`` when it still mirrored the old target name).
   */
  private propagateContainerRenames(prevElements: ModelState['elements']) {
    const { elements, update } = this.props;
    const renames: Array<[string, string]> = [];
    for (const el of Object.values(elements)) {
      if (el.type !== NNElementType.NNContainer) continue;
      const prev = prevElements[el.id];
      if (prev && prev.type === NNElementType.NNContainer && prev.name !== el.name) {
        renames.push([prev.name, el.name]);
      }
    }
    if (renames.length === 0) return;

    const renameMap = new Map(renames);
    // Collapse rename chains: if the same dispatch renamed "A"→"B" AND
    // "B"→"C", a reference originally pointing at "A" must end up at "C",
    // not "B". Follow each chain until it stabilizes (cycle-safe via a
    // visited set).
    const resolve = (name: string): string => {
      let current = name;
      const seen = new Set<string>([current]);
      while (renameMap.has(current)) {
        const next = renameMap.get(current)!;
        if (seen.has(next)) break;  // cyclic rename (A→B→A) — bail
        seen.add(next);
        current = next;
      }
      return current;
    };
    for (const el of Object.values(elements)) {
      if (el.type !== NNElementType.NNReference) continue;
      const ref = el as any;
      if (!renameMap.has(ref.referencedNN)) continue;
      const newTarget = resolve(ref.referencedNN);
      if (newTarget === ref.referencedNN) continue;
      const patch: any = { referencedNN: newTarget };
      // Only rewrite the visible label if it was tracking the old target —
      // preserve user-supplied custom labels (see NNReference constructor).
      if (el.name === ref.referencedNN) {
        patch.name = newTarget;
      }
      update(el.id, patch);
    }
  }

  private isActive(): boolean {
    return this.props.diagramType === UMLDiagramType.NNDiagram;
  }

  private checkAndUpdateAssociations() {
    const { elements } = this.props;

    const isDataset = (t: string | undefined) =>
      t === NNElementType.TrainingDataset || t === NNElementType.TestDataset;

    Object.values(elements).forEach((element: any) => {
      if (!UMLRelationship.isUMLRelationship(element)) return;

      const source = elements[element.source?.element];
      const target = elements[element.target?.element];

      // Delete any NNNext connection involving NNContainer, Configuration, or Datasets
      if (element.type === NNRelationshipType.NNNext) {
        const isInvalid =
          source?.type === NNElementType.NNContainer ||
          source?.type === NNElementType.Configuration ||
          isDataset(source?.type) ||
          target?.type === NNElementType.NNContainer ||
          target?.type === NNElementType.Configuration ||
          isDataset(target?.type);
        if (isInvalid) {
          this.props.delete(element.id);
          return;
        }
      }

      // NNAssociation must connect a Dataset to an NNContainer (either direction)
      if (element.type === NNRelationshipType.NNAssociation) {
        const validPair =
          (isDataset(source?.type) && target?.type === NNElementType.NNContainer) ||
          (isDataset(target?.type) && source?.type === NNElementType.NNContainer);
        if (!validPair) {
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

  // Delete optional attribute children that are no longer valid for the parent's
  // current selector value (e.g. input_format, pooling_type, tns_type). Keeps the
  // underlying model consistent with what the popup UI shows.
  private cleanupHiddenOptionalAttributes() {
    const { elements } = this.props;
    const all = Object.values(elements);
    const attrName = (el: any) => (el ? (el as INNAttribute).attributeName : undefined);
    const attrValue = (el: any) => (el ? (el as INNAttribute).value : undefined);

    const childrenOf = (ownerId: string) => all.filter((el: any) => el.owner === ownerId);
    const findAttr = (children: any[], name: string) => children.find((c) => attrName(c) === name);
    const deleteByNames = (children: any[], names: string[]) => {
      children.forEach((child) => {
        const name = attrName(child);
        if (name && names.includes(name)) {
          this.props.delete(child.id);
        }
      });
    };

    all.forEach((owner: any) => {
      // Datasets: shape/normalize only apply when input_format === 'images'
      if (owner.type === NNElementType.TrainingDataset || owner.type === NNElementType.TestDataset) {
        const children = childrenOf(owner.id);
        const inputFormat = attrValue(findAttr(children, 'input_format'));
        if (inputFormat && inputFormat !== 'images') {
          deleteByNames(children, ['shape', 'normalize']);
        }
      }

      // Pooling: hidden optionals depend on pooling_type
      if (owner.type === NNElementType.PoolingLayer) {
        const children = childrenOf(owner.id);
        const poolingType = attrValue(findAttr(children, 'pooling_type'));
        if (poolingType === 'global_average' || poolingType === 'global_max') {
          deleteByNames(children, ['kernel_dim', 'stride_dim', 'padding_amount', 'padding_type', 'output_dim']);
        } else if (poolingType === 'adaptive_average' || poolingType === 'adaptive_max') {
          deleteByNames(children, ['kernel_dim', 'stride_dim', 'padding_amount', 'padding_type']);
        } else if (poolingType === 'average' || poolingType === 'max') {
          deleteByNames(children, ['output_dim']);
        }
      }

      // TensorOp: each tns_type reveals a specific set of list attributes
      if (owner.type === NNElementType.TensorOp) {
        const children = childrenOf(owner.id);
        const tnsType = attrValue(findAttr(children, 'tns_type'));
        const allDims = ['reshape_dim', 'concatenate_dim', 'transpose_dim', 'permute_dim'];
        let keep: string[] = [];
        switch (tnsType) {
          case 'reshape':     keep = ['reshape_dim']; break;
          case 'concatenate': keep = ['concatenate_dim']; break;
          case 'transpose':   keep = ['transpose_dim']; break;
          case 'permute':     keep = ['permute_dim']; break;
          default:            keep = []; break;
        }
        const toDelete = allDims.filter((n) => !keep.includes(n));
        deleteByNames(children, toDelete);
      }
    });
  }

  render() {
    return null;
  }
}

const enhance = compose<ComponentClass>(
  connect<StateProps, DispatchProps, {}, ModelState>(
    (state) => ({
      elements: state.elements,
      diagramType: state.diagram?.type,
    }),
    {
      delete: UMLElementRepository.delete,
      update: UMLElementRepository.update,
    }
  )
);

export const NNAssociationMonitor = enhance(NNAssociationMonitorComponent);