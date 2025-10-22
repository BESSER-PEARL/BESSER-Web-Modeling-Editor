import React, { Component, ComponentClass } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import { Button } from '../../../components/controls/button/button';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { Divider } from '../../../components/controls/divider/divider';
import { Dropdown } from '../../../components/controls/dropdown/dropdown';
import { ExchangeIcon } from '../../../components/controls/icon/exchange';
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
import { diagramBridge } from '../../../services/diagram-bridge';
import { AsyncDispatch } from '../../../utils/actions/actions';
import { UMLIconObjectLink } from './uml-icon-object-link';

const Flex = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
`;

const AssociationSelectionFlex = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
`;

type State = { colorOpen: boolean };

class ObjectIconLinkUpdate extends Component<Props, State> {
  state = { colorOpen: false };

  private toggleColor = () => {
    this.setState((state) => ({
      colorOpen: !state.colorOpen,
    }));
  };  private getAvailableAssociations = () => {
    const { element, getById } = this.props;
    const sourceElement = element.source && getById(element.source.element);
    const targetElement = element.target && getById(element.target.element);
    
    if (!sourceElement || !targetElement) return [];
    
    // Get class IDs directly from the connected objects (they are ObjectName elements)
    const sourceClassId = (sourceElement as any).classId;
    const targetClassId = (targetElement as any).classId;
    
    if (!sourceClassId || !targetClassId) {
      return [];
    }
    
    // Use diagram bridge service to get associations
    return diagramBridge.getAvailableAssociations(sourceClassId, targetClassId);
  };
  private onAssociationChange = (associationId: string) => {
    const availableAssociations = this.getAvailableAssociations();
    const selectedAssociation = availableAssociations.find(assoc => assoc.id === associationId);
    
    const updateData: any = {};
    
    if (selectedAssociation) {
      // Use the association's actual name or generate display name as the link name
      const displayName = this.getRelationshipDisplayName(selectedAssociation, 
        this.props.getById(this.props.element.source?.element),
        this.props.getById(this.props.element.target?.element)
      );
      updateData.name = selectedAssociation.name || displayName;
      updateData.associationId = selectedAssociation.id;
    } else {
      // No association selected
      updateData.name = this.props.element.name || ''; // Keep existing name
      updateData.associationId = undefined;
    }
    
    this.props.update(this.props.element.id, updateData);
  };
  private getSelectedAssociationId = () => {
    return (this.props.element as any).associationId || '';
  };  private getRelationshipDisplayName = (relationship: any, sourceObject: any, targetObject: any) => {
    return diagramBridge.getRelationshipDisplayName(
      relationship,
      sourceObject?.name || 'Object',
      targetObject?.name || 'Object'
    );
  };

  render() {
    const { element, getById } = this.props;
    const source = element.source && getById(element.source.element);
    const target = element.target && getById(element.target.element);
    
    if (!source || !target) return null;    const availableAssociations = this.getAvailableAssociations();
    const selectedAssociationId = this.getSelectedAssociationId();

    return (
      <div>
        <section>
          <Flex>
            <Header gutter={false} style={{ flexGrow: 1 }}>
              {this.props.translate('popup.objectLink')}
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
        
        <section>
          <Header>
            {this.props.translate('popup.linkDetails')} (
            <small>
              {source.name} ⟶ {target.name}
            </small>
            )
          </Header>
          
          <Flex>
            <Body style={{ marginRight: '0.5em' }}>{this.props.translate('popup.name')}</Body>
            <Textfield
              value={element.name || ''}
              onChange={(value) => this.props.update(element.id, { name: value })}
              placeholder="Link name"
            />
          </Flex>
            {availableAssociations.length > 0 && (
            <AssociationSelectionFlex>
              <Body>{this.props.translate('popup.association')}</Body>              <Dropdown 
                value={selectedAssociationId || ''} 
                onChange={this.onAssociationChange}
              >
                {[
                  <Dropdown.Item key="empty" value="">
                    {this.props.translate('popup.noAssociation')}
                  </Dropdown.Item>,
                  ...availableAssociations.map((association) => {
                    const displayName = this.getRelationshipDisplayName(association, source, target);
                    return (
                      <Dropdown.Item key={association.id} value={association.id}>
                        {displayName}
                      </Dropdown.Item>
                    );
                  })
                ]}
              </Dropdown>
              {/*{selectedAssociationId && (
                <div style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
                  Association ID: {selectedAssociationId}
                </div>
              )}*/}
            </AssociationSelectionFlex>
          )}
          
          {availableAssociations.length === 0 && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#999', fontStyle: 'italic' }}>
              {this.props.translate('popup.noAssociationsAvailable')}
            </div>
          )}
        </section>
      </div>
    );
  }
}

type OwnProps = {
  element: UMLIconObjectLink;
};

type StateProps = {};

type DispatchProps = {
  update: typeof UMLElementRepository.update;
  delete: typeof UMLElementRepository.delete;
  flip: typeof UMLRelationshipRepository.flip;
  getById: (id: string) => UMLElement | null;
};

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(null, {
    update: UMLElementRepository.update,
    delete: UMLElementRepository.delete,
    flip: UMLRelationshipRepository.flip,
    getById: UMLElementRepository.getById as any as AsyncDispatch<typeof UMLElementRepository.getById>,
  }),
);

export const UMLIconObjectLinkUpdate = enhance(ObjectIconLinkUpdate);
