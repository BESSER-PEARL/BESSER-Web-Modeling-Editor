import React, { Component, ComponentType } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import { ClassRelationshipType } from '..';
import { Button } from '../../../components/controls/button/button';
import { Checkbox } from '../../../components/controls/checkbox/checkbox';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { Divider } from '../../../components/controls/divider/divider';
import { Dropdown } from '../../../components/controls/dropdown/dropdown';
import { ExchangeIcon } from '../../../components/controls/icon/exchange';
import { HelpIcon } from '../../../components/controls/icon/help';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Body, Header } from '../../../components/controls/typography/typography';
import { I18nContext } from '../../../components/i18n/i18n-context';
import { localized } from '../../../components/i18n/localized';
import { ModelState } from '../../../components/store/model-state';
import { StylePane } from '../../../components/style-pane/style-pane';
import { styled } from '../../../components/theme/styles';
import { UMLElement } from '../../../services/uml-element/uml-element';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { UMLRelationshipRepository } from '../../../services/uml-relationship/uml-relationship-repository';
import { AsyncDispatch } from '../../../utils/actions/actions';
import { UMLAssociation } from '../../common/uml-association/uml-association';
import { erCardinalityToUML } from '../../common/uml-association/multiplicity';
import {
  AssociationEnd,
  canToggleNavigability,
  enforceNavigabilityRules,
  normalizeAssociationType,
  resolveAssociationNavigability,
  supportsNavigability,
} from '../../common/uml-association/uml-association-navigability';
import { settingsService } from '../../../services/settings/settings-service';

type OwnProps = {
  element: UMLAssociation;
};

type StateProps = {};

type DispatchProps = {
  update: typeof UMLElementRepository.update;
  delete: typeof UMLElementRepository.delete;
  flip: typeof UMLRelationshipRepository.flip;
  getById: (id: string) => UMLElement | null;
};

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

const enhance = compose<ComponentType<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(null, {
    update: UMLElementRepository.update,
    delete: UMLElementRepository.delete,
    flip: UMLRelationshipRepository.flip,
    getById: UMLElementRepository.getById as any as AsyncDispatch<typeof UMLElementRepository.getById>,
  }),
);

const Flex = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
`;

const Label = styled.span`
  display: flex;
  align-items: center;
`;

const InfoIcon = styled.span`
  display: inline-flex;
  margin-left: 0.35em;
  cursor: help;
  opacity: 0.6;

  svg {
    display: block;
    width: 0.8em;
    height: 0.8em;
  }

  :hover {
    opacity: 1;
  }
`;

type State = { colorOpen: boolean };

class ClassAssociationComponent extends Component<Props, State> {
  state = { colorOpen: false };

  private toggleColor = () => {
    this.setState((state) => ({
      colorOpen: !state.colorOpen,
    }));
  };

  render() {
    const { element, getById } = this.props;
    const source = element.source && getById(element.source.element);
    const target = element.target && getById(element.target.element);
    if (!source || !target) return null;

    const isInheritance = element.type === ClassRelationshipType.ClassInheritance;
    const showsNavigability = supportsNavigability(element.type);
    const navigability = resolveAssociationNavigability(element);
    // Hint both accepted syntaxes when ER display mode is active. The
    // stored value is still UML, so the textfield itself shows the UML
    // form — the placeholder is just there so ER-native users know
    // "(1,N)" is accepted as input.
    const multiplicityPlaceholder =
      settingsService.getClassNotation() === 'ER' ? '(1,1) or 1..1' : '1..1';

    return (
      <div>
        <section>
          <Flex>
            <Header gutter={false} style={{ flexGrow: 1 }}>
              {this.props.translate('popup.association')}
            </Header>
            <ColorButton onClick={this.toggleColor} />
            <Button color="link" onClick={() => this.props.flip(element.id)}>
              <ExchangeIcon />
            </Button>
            <Button color="link" onClick={() => this.props.delete(element.id)}>
              <TrashIcon />
            </Button>
          </Flex>
          <StylePane
            open={this.state.colorOpen}
            element={element}
            onColorChange={this.props.update}
            lineColor
            textColor
          />
          <Divider />
        </section>
        {!isInheritance && (
          <section>
            <Flex>
              <Body style={{ marginRight: '0.5em' }}>{this.props.translate('popup.name')}</Body>
              <Textfield
                value={element.name}
                onChange={(value) => this.props.update(element.id, { name: value })}
                placeholder={this.props.translate('popup.associationNamePlaceholder')}
              />
            </Flex>
            <Divider />
          </section>
        )}
        <section>
          <Dropdown
            value={normalizeAssociationType(element.type) as keyof typeof ClassRelationshipType}
            onChange={this.onChange}
          >
            {/*<Dropdown.Item value={ClassRelationshipType.ClassAggregation}>
              {this.props.translate('packages.ClassDiagram.ClassAggregation')}
            </Dropdown.Item>*/}
            <Dropdown.Item value={ClassRelationshipType.ClassBidirectional}>
              {this.props.translate('packages.ClassDiagram.ClassBidirectional')}
            </Dropdown.Item>
            <Dropdown.Item value={ClassRelationshipType.ClassComposition}>
              {this.props.translate('packages.ClassDiagram.ClassComposition')}
            </Dropdown.Item>
            {/*<Dropdown.Item value={ClassRelationshipType.ClassDependency}>
              {this.props.translate('packages.ClassDiagram.ClassDependency')}
            </Dropdown.Item>*/}
            <Dropdown.Item value={ClassRelationshipType.ClassInheritance}>
              {this.props.translate('packages.ClassDiagram.ClassInheritance')}
            </Dropdown.Item>
           {/* <Dropdown.Item value={ClassRelationshipType.ClassRealization}>
              {this.props.translate('packages.ClassDiagram.ClassRealization')}
            </Dropdown.Item>*/}
          </Dropdown>
          <Divider />
        </section>
        {!isInheritance && (
          <>
            <section>
              <Header>{source.name}</Header>
              <Flex>
                <Body style={{ marginRight: '0.5em' }}>{this.props.translate('popup.multiplicity')}</Body>
                <Textfield
                  style={{ minWidth: 0 }}
                  gutter
                  value={element.source.multiplicity}
                  onChange={this.onUpdate('multiplicity', 'source')}
                  autoFocus
                  placeholder={multiplicityPlaceholder}
                />
              </Flex>
              <Flex>
                <Body style={{ marginRight: '0.5em' }}>{this.props.translate('popup.role')}</Body>
                <Textfield value={element.source.role} onChange={this.onUpdate('role', 'source')} />
              </Flex>
              {showsNavigability && (
                <Flex>
                  <Label>
                    <Body>{this.props.translate('popup.navigable')}</Body>
                    <InfoIcon title={this.navigableInfoText('source')}>
                      <HelpIcon />
                    </InfoIcon>
                  </Label>
                  <Checkbox
                    checked={navigability.source}
                    disabled={!canToggleNavigability(element, 'source')}
                    title={this.navigableHint('source')}
                    onChange={this.onToggleNavigable('source')}
                  />
                </Flex>
              )}
              <Divider />
            </section>
            <section>
              <Header>{target.name}</Header>
              <Flex>
                <Body style={{ marginRight: '0.5em' }}>{this.props.translate('popup.multiplicity')}</Body>
                <Textfield
                  style={{ minWidth: 0 }}
                  gutter
                  value={element.target.multiplicity}
                  onChange={this.onUpdate('multiplicity', 'target')}
                  placeholder={multiplicityPlaceholder}
                />
              </Flex>
              <Flex>
                <Body style={{ marginRight: '0.5em' }}>{this.props.translate('popup.role')}</Body>
                <Textfield value={element.target.role} onChange={this.onUpdate('role', 'target')} />
              </Flex>
              {showsNavigability && (
                <Flex>
                  <Label>
                    <Body>{this.props.translate('popup.navigable')}</Body>
                    <InfoIcon title={this.navigableInfoText('target')}>
                      <HelpIcon />
                    </InfoIcon>
                  </Label>
                  <Checkbox
                    checked={navigability.target}
                    disabled={!canToggleNavigability(element, 'target')}
                    title={this.navigableHint('target')}
                    onChange={this.onToggleNavigable('target')}
                  />
                </Flex>
              )}
            </section>
          </>
        )}
      </div>
    );
  }
  // A type change carries the navigability the new type requires (e.g. the part
  // end of a composition is always navigable) in the same update, so it is a
  // single undo step and never leaves an invalid association behind.
  private onChange = (type: keyof typeof ClassRelationshipType) => {
    const { element, update } = this.props;
    if (!supportsNavigability(type)) {
      update(element.id, { type });
      return;
    }
    const navigability = resolveAssociationNavigability({ ...element, type });
    update<UMLAssociation>(element.id, {
      type,
      source: { ...element.source, navigable: navigability.source },
      target: { ...element.target, navigable: navigability.target },
    });
  };

  private onUpdate = (type: 'multiplicity' | 'role', end: 'source' | 'target') => (value: string) => {
    const { element, update } = this.props;
    // Accept ER-style "(min,max)" input and normalize to UML form before
    // storing. Storage is always UML — ER is a display-only flavor — so a
    // user typing "(0,N)" in ER mode has the same effect as typing "0..*".
    // UML input is returned unchanged by erCardinalityToUML, so this is
    // safe to apply regardless of the active notation.
    const storedValue = type === 'multiplicity' ? erCardinalityToUML(value) : value;
    update<UMLAssociation>(element.id, { [end]: { ...element[end], [type]: storedValue } });
  };

  // Disabled form controls don't show their `title` tooltip in most browsers,
  // so the explanation also has to live on the always-hoverable info icon
  // next to the label -- both read from this same source of truth.
  private navigableInfoText = (end: AssociationEnd): string => {
    const { element } = this.props;
    if (element.type === ClassRelationshipType.ClassComposition && end === 'source') {
      return this.props.translate('popup.navigableCompositionHint');
    }
    if (!canToggleNavigability(element, end)) {
      return this.props.translate('popup.navigableDisabledHint');
    }
    return this.props.translate('popup.navigableInfo');
  };

  private navigableHint = (end: AssociationEnd): string | undefined => {
    return canToggleNavigability(this.props.element, end) ? undefined : this.navigableInfoText(end);
  };

  // Both ends being non-navigable is not a valid association, so the last
  // navigable end can't be switched off, and the part (source) end of a
  // composition always stays navigable. Both flags (and the legacy type, if
  // any) are written in one update so the toggle is a single undo step.
  private onToggleNavigable = (end: AssociationEnd) => (checked: boolean) => {
    const { element, update } = this.props;
    if (!canToggleNavigability(element, end)) {
      return;
    }
    const navigability = enforceNavigabilityRules(
      element.type,
      { ...resolveAssociationNavigability(element), [end]: checked },
      end,
    );
    update<UMLAssociation>(element.id, {
      type: normalizeAssociationType(element.type),
      source: { ...element.source, navigable: navigability.source },
      target: { ...element.target, navigable: navigability.target },
    });
  };
}

export const UMLClassAssociationUpdate = enhance(ClassAssociationComponent);