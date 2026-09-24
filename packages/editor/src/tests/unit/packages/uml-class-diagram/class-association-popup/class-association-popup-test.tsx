import * as React from 'react';
import { getRealStore } from '../../../test-utils/test-utils';
import { UMLClassBidirectional } from '../../../../../main/packages/uml-class-diagram/uml-class-bidirectional/uml-class-bidirectional';
import { UMLClassAssociationUpdate } from '../../../../../main/packages/uml-class-diagram/uml-class-association/uml-class-association-update';
import { UMLClass } from '../../../../../main/packages/uml-class-diagram/uml-class/uml-class';
import { Direction } from '../../../../../main/services/uml-element/uml-element-port';
import { UMLElement } from '../../../../../main/services/uml-element/uml-element';
import { wrappedRender } from '../../../test-utils/render';
import { ClassRelationshipType } from '../../../../../main/packages/uml-class-diagram';
import { act, fireEvent } from '@testing-library/react';
import { UMLClassComposition } from '../../../../../main/packages/uml-class-diagram/uml-class-composition/uml-class-composition';
import { UMLAssociation } from '../../../../../main/packages/common/uml-association/uml-association';
import { UMLElementActionTypes } from '../../../../../main/services/uml-element/uml-element-types';

describe('test class association popup', () => {
  let elements: UMLElement[] = [];
  let source: UMLClass;
  let target: UMLClass;
  let classAssociation: UMLClassBidirectional;

  beforeEach(() => {
    // initialize  objects
    source = new UMLClass({ id: 'source-test-id' });
    target = new UMLClass({ id: 'target-test-id' });
    classAssociation = new UMLClassBidirectional({
      id: 'test-id',
      name: 'UMLClassBidirectional',
      source: { element: source.id, direction: Direction.Up },
      target: { element: target.id, direction: Direction.Up },
    });
    elements.push(source, target, classAssociation);
  });

  // Skip failing snapshot test
  it.skip('render', () => {
    const store = getRealStore(undefined, elements);

    const { baseElement } = wrappedRender(<UMLClassAssociationUpdate element={classAssociation} />, { store });
    expect(baseElement).toMatchSnapshot();
  });

  it('flip', () => {
    const store = getRealStore(undefined, elements);

    const { getAllByRole } = wrappedRender(<UMLClassAssociationUpdate element={classAssociation} />, { store: store });
    const buttons = getAllByRole('button');

    act(() => {
      fireEvent.click(buttons[0]);
    });
    const element = store.getState().elements[classAssociation.id] as UMLClassBidirectional;

    expect(element.target).toEqual(classAssociation.source);
    expect(element.source).toEqual(classAssociation.target);
  });

  it('delete', () => {
    const store = getRealStore(undefined, elements);

    const { getAllByRole } = wrappedRender(<UMLClassAssociationUpdate element={classAssociation} />, { store: store });
    const buttons = getAllByRole('button');

    act(() => {
      fireEvent.click(buttons[1]);
    });

    expect(store.getState().elements).not.toContain(classAssociation.id);
  });

  it.skip('change type to ClassAggregation', () => {
    const store = getRealStore(undefined, elements);

    const { getAllByRole } = wrappedRender(<UMLClassAssociationUpdate element={classAssociation} />, { store: store });
    const buttons = getAllByRole('button');
    act(() => {
      fireEvent.click(buttons[2]);
    });

    const updatedButtons = getAllByRole('button');

    act(() => {
      fireEvent.click(updatedButtons[3]);
    });

    expect(store.getState().elements[classAssociation.id].type).toEqual(ClassRelationshipType.ClassAggregation);
  });

  it.skip('change source multiplicity and role', () => {
    const store = getRealStore(undefined, elements);

    const { getAllByRole, rerender } = wrappedRender(<UMLClassAssociationUpdate element={classAssociation} />, {
      store: store,
    });
    const textboxes = getAllByRole('textbox');
    const sourceMultiplicityValue = '1';
    const sourceRole = 'role';
    act(() => {
      fireEvent.change(textboxes[0], { target: { value: sourceMultiplicityValue } });
    });

    let updatedElement = store.getState().elements[classAssociation.id] as UMLClassBidirectional;
    rerender(<UMLClassAssociationUpdate element={updatedElement} />);

    act(() => {
      fireEvent.change(textboxes[1], { target: { value: sourceRole } });
    });

    updatedElement = store.getState().elements[classAssociation.id] as UMLClassBidirectional;

    expect(updatedElement.source.multiplicity).toEqual(sourceMultiplicityValue);
    expect(updatedElement.source.role).toEqual(sourceRole);
  });
  describe('navigability', () => {
    const makeAssociation = (
      Type: typeof UMLClassBidirectional | typeof UMLClassComposition,
      sourceNavigable: boolean,
      targetNavigable: boolean,
    ) =>
      new Type({
        id: 'nav-id',
        source: { element: source.id, direction: Direction.Up, navigable: sourceNavigable },
        target: { element: target.id, direction: Direction.Up, navigable: targetNavigable },
      });

    const renderPopup = (association: UMLAssociation) => {
      const store = getRealStore(undefined, [source, target, association]);
      // record every plain action the popup dispatches
      const dispatched: any[] = [];
      const dispatch = store.dispatch;
      store.dispatch = ((action: any) => {
        if (typeof action === 'object') dispatched.push(action);
        return dispatch(action);
      }) as typeof store.dispatch;
      const updates = () => dispatched.filter((action) => action.type === UMLElementActionTypes.UPDATE);
      const result = wrappedRender(<UMLClassAssociationUpdate element={association} />, { store });
      const current = () => store.getState().elements[association.id] as UMLAssociation;
      return { store, current, updates, ...result };
    };

    it('toggling a checkbox flips navigable on that end', () => {
      const { getAllByRole, current, updates } = renderPopup(makeAssociation(UMLClassBidirectional, true, true));
      const [sourceBox, targetBox] = getAllByRole('checkbox') as HTMLInputElement[];
      expect(sourceBox.checked).toBe(true);
      expect(targetBox.checked).toBe(true);

      act(() => {
        fireEvent.click(sourceBox);
      });

      expect(updates()).toHaveLength(1);
      expect(current().source.navigable).toBe(false);
      expect(current().target.navigable).toBe(true);
      expect(current().type).toEqual(ClassRelationshipType.ClassBidirectional);
    });

    it('disables the last navigable end', () => {
      const { getAllByRole } = renderPopup(makeAssociation(UMLClassBidirectional, false, true));
      const [sourceBox, targetBox] = getAllByRole('checkbox') as HTMLInputElement[];
      expect(sourceBox.disabled).toBe(false);
      expect(targetBox.disabled).toBe(true);
    });

    it('locks the part (source) end of a composition', () => {
      const { getAllByRole, current } = renderPopup(makeAssociation(UMLClassComposition, true, true));
      const [sourceBox, targetBox] = getAllByRole('checkbox') as HTMLInputElement[];
      expect(sourceBox.checked).toBe(true);
      expect(sourceBox.disabled).toBe(true);
      expect(targetBox.disabled).toBe(false);

      act(() => {
        fireEvent.click(sourceBox);
      });
      expect(current().source.navigable).toBe(true);
    });

    it('switching to Composition with the part end unchecked yields a valid model in one update', () => {
      const association = makeAssociation(UMLClassBidirectional, false, true);
      const { current, updates, getByText, getByRole, rerender } = renderPopup(association);

      act(() => {
        fireEvent.click(getByRole('button', { name: 'Association' }));
      });
      act(() => {
        fireEvent.click(getByText('Composition'));
      });

      expect(current().type).toEqual(ClassRelationshipType.ClassComposition);
      expect(current().source.navigable).toBe(true);
      expect(current().target.navigable).toBe(true);

      expect(updates()).toHaveLength(1);

      // re-rendering with the updated element must not dispatch a follow-up fix
      rerender(<UMLClassAssociationUpdate element={current()} />);
      expect(updates()).toHaveLength(1);
    });

    it('hides the navigable checkboxes where navigability has no meaning', () => {
      const association = makeAssociation(UMLClassBidirectional, true, true);
      association.type = ClassRelationshipType.ClassDependency;
      const { queryAllByRole } = renderPopup(association);
      expect(queryAllByRole('checkbox')).toHaveLength(0);
    });
  });
});
