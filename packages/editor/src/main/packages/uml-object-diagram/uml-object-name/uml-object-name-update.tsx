import React, { Component, ComponentClass, createRef } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import styled from 'styled-components';
import { Button } from '../../../components/controls/button/button';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { diagramBridge } from '../../../services/diagram-bridge';
import { Divider } from '../../../components/controls/divider/divider';
import { Dropdown } from '../../../components/controls/dropdown/dropdown';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Body, Header } from '../../../components/controls/typography/typography';
import { I18nContext } from '../../../components/i18n/i18n-context';
import { localized } from '../../../components/i18n/localized';
import { ModelState } from '../../../components/store/model-state';
import { StylePane } from '../../../components/style-pane/style-pane';
import { UMLElement } from '../../../services/uml-element/uml-element';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { AsyncDispatch } from '../../../utils/actions/actions';
import { notEmpty } from '../../../utils/not-empty';
import { UMLObjectAttribute } from '../uml-object-attribute/uml-object-attribute';
import { UMLObjectMethod } from '../uml-object-method/uml-object-method';
import { UMLObjectName } from './uml-object-name';
import UMLObjectAttributeUpdate from '../uml-object-attribute/uml-object-attribute-update';

const Flex = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
`;

const ClassSelectionFlex = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
`;

type State = {
  fieldToFocus?: Textfield<string> | null;
  colorOpen: boolean;
};

const getInitialState = (): State => ({
  fieldToFocus: undefined,
  colorOpen: false,
});

class ObjectNameComponent extends Component<Props, State> {
  state = getInitialState();
  newMethodField = createRef<Textfield<string>>();
  newAttributeField = createRef<Textfield<string>>();
  private toggleColor = () => {
    this.setState((state) => ({
      colorOpen: !state.colorOpen,
    }));
  };    private getAvailableClasses = () => {
    return diagramBridge.getAvailableClasses();
  };

  private getClassDisplayName = (cls: any) => {
    const hierarchy = diagramBridge.getClassHierarchy(cls.id);
    let displayName = cls.name;
    
    // Show inheritance info if the class has parents
    if (hierarchy.length > 1) {
      const parents = hierarchy.slice(1); // Remove the class itself, keep parents
      displayName += ` extends ${parents.join(', ')}`;
    }
    
    // Show attribute count (including inherited)
    if (cls.attributes.length > 0) {
      displayName += ` (${cls.attributes.length} attrs)`;
    }
    
    return displayName;
  };
  private onClassChange = (className: string) => {
    const { element, update, create, delete: deleteElement, getById } = this.props;
    
    // Find the selected class to get its ID
    const availableClasses = this.getAvailableClasses();
    const selectedClass = availableClasses.find(cls => cls.name === className);
    
    // Update the object with the class ID and potentially the name
    const updateData: any = {};
    if (selectedClass) {
      updateData.classId = selectedClass.id; // Store the class ID from the library
      
      // If the current name is "Object" or empty, update it with the new class-based name
      if (!element.name || element.name === 'Object') {
        updateData.name = `${selectedClass.name.toLowerCase()}Instance`;
      }
    } else {
      updateData.classId = undefined; // Clear class ID if no class is selected
      
      // If current name was based on a class, reset to "Object"
      if (!element.name || element.name === 'Object') {
        updateData.name = 'Object';
      }
    }
    
    update(element.id, updateData);
    
    // First, delete all existing attributes
    const children = element.ownedElements.map((id) => getById(id)).filter(notEmpty);
    const existingAttributes = children.filter((child) => child instanceof UMLObjectAttribute);
    existingAttributes.forEach((attr) => {
      deleteElement(attr.id);
    });    // If a class is selected, automatically add its attributes to the object (including inherited)
    if (className && selectedClass && selectedClass.attributes.length > 0) {
      // Create object attributes based on class attributes with proper format
      // Note: selectedClass.attributes already includes inherited attributes from parent classes
      selectedClass.attributes.forEach((attr: { id: string, name: string }) => {
        const attribute = new UMLObjectAttribute();
        // Format: "attributeName = " to show that it needs a value
        attribute.name = `${attr.name} = `;
        // Store the attribute ID from the library
        (attribute as any).attributeId = attr.id;
        create(attribute, element.id);
      });
    }
  };
  private getSelectedClass = () => {
    const { element } = this.props;
    const classId = (element as any).classId;
    if (!classId) return '';
    
    // First try to find the class in available classes from diagramBridge
    const availableClasses = this.getAvailableClasses();
    let selectedClass = availableClasses.find(cls => cls.id === classId);
    
    // If not found in available classes, try to find it in the stored class diagram data
    if (!selectedClass) {
      const classDiagramData = diagramBridge.getClassDiagramData();
      if (classDiagramData && classDiagramData.elements) {
        const refClass = classDiagramData.elements[classId];
        if (refClass && refClass.type === 'Class') {
          return refClass.name;
        }
      }
    }
    
    return selectedClass ? selectedClass.name : '';
  };
  private getSelectedClassId = () => {
    const { element } = this.props;
    return (element as any).classId || '';
  };
  private getObjectNamePlaceholder = () => {
    const selectedClassName = this.getSelectedClass();
    if (selectedClassName) {
      return `${selectedClassName.toLowerCase()}Instance`;
    }
    return 'objectName';
  };

  private getDisplayName = () => {
    const { element } = this.props;
    // If name is empty or "Object", show placeholder as the actual value
    if (!element.name || element.name === 'Object') {
      return this.getObjectNamePlaceholder();
    }
    return element.name;
  };
  // Method to get class info by ID for verification
  private getClassById = (classId: string) => {
    // First try in available classes
    const availableClasses = this.getAvailableClasses();
    let selectedClass = availableClasses.find(cls => cls.id === classId);
    
    // If not found, try in stored class diagram data
    if (!selectedClass) {
      const classDiagramData = diagramBridge.getClassDiagramData();
      if (classDiagramData && classDiagramData.elements) {
        const refClass = classDiagramData.elements[classId];
        if (refClass && refClass.type === 'Class') {
          // Convert to IClassInfo format
          return {
            id: refClass.id,
            name: refClass.name,
            attributes: (refClass.attributes || []).map((attrId: string) => {
              const attr = classDiagramData.elements[attrId];
              return attr ? { id: attrId, name: attr.name } : null;
            }).filter(Boolean)
          };
        }
      }
    }
    
    return selectedClass || null;
  };

  componentDidUpdate(prevProps: Readonly<Props>, prevState: Readonly<{}>, snapshot?: any) {
    if (this.state.fieldToFocus) {
      this.state.fieldToFocus.focus();
      this.setState({ fieldToFocus: undefined });
    }
  }
  render() {
    const { element, getById } = this.props;
    const children = element.ownedElements.map((id) => getById(id)).filter(notEmpty);
    const attributes = children.filter((child) => child instanceof UMLObjectAttribute);
    const methods = children.filter((child) => child instanceof UMLObjectMethod);
    const attributeRefs: (Textfield<string> | null)[] = [];
    const methodRefs: (Textfield<string> | null)[] = [];
    const availableClasses = this.getAvailableClasses();

    return (
      <div>        <section>
          <Flex>
            <Textfield 
              value={this.getDisplayName()} 
              onChange={this.rename(element.id)} 
              placeholder={this.getObjectNamePlaceholder()}
              autoFocus 
            />
            <ColorButton onClick={this.toggleColor} />
            <Button color="link" tabIndex={-1} onClick={this.delete(element.id)}>
              <TrashIcon />
            </Button>
          </Flex>{availableClasses.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <ClassSelectionFlex>
                <Body style={{ marginRight: '0.5em' }}>Class:</Body>                
                <Dropdown 
                  value={this.getSelectedClass()}
                  onChange={this.onClassChange}
                >
                  {[
                    <Dropdown.Item key="empty" value="">No class selected</Dropdown.Item>,
                    ...availableClasses.map((cls: any) => (
                      <Dropdown.Item key={cls.id} value={cls.name}>
                        {this.getClassDisplayName(cls)}
                      </Dropdown.Item>
                    ))
                  ]}
                </Dropdown></ClassSelectionFlex>
              {/* Debug info to show stored class ID and hierarchy */}
              {/* {this.getSelectedClassId() && (
                <div style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
                  <div>Class ID: {this.getSelectedClassId()}</div>
                  {(() => {
                    const selectedClass = this.getClassById(this.getSelectedClassId());
                    if (selectedClass) {
                      const hierarchy = diagramBridge.getClassHierarchy(selectedClass.id);
                      if (hierarchy.length > 1) {
                        return <div>Hierarchy: {hierarchy.join(' → ')}</div>;
                      }
                    }
                    return null;
                  })()}
                </div>
              )} */}
            </div>
          )}
          <StylePane
            open={this.state.colorOpen}
            element={element}
            onColorChange={this.props.update}
            fillColor
            lineColor
            textColor
          />
          <Divider />
        </section>
        <section>          <Header>{this.props.translate('popup.attributes')}</Header>
          {attributes.map((attribute, index) => (
            <UMLObjectAttributeUpdate
              id={attribute.id}
              key={attribute.id}
              value={attribute.name}
              onChange={this.props.update}
              onSubmitKeyUp={() =>
                index === attributes.length - 1
                  ? this.newAttributeField.current?.focus()
                  : this.setState({
                      fieldToFocus: attributeRefs[index + 1],
                    })
              }
              onDelete={this.delete}
              onRefChange={(ref) => (attributeRefs[index] = ref)}
              element={attribute}
            />
          ))}
          {/* <Textfield
            ref={this.newAttributeField}
            outline
            value=""
            onSubmit={this.create(UMLObjectAttribute)}
            onSubmitKeyUp={(key: string, value: string) => {
              // if we have a value -> navigate to next field in case we want to create a new element
              if (value) {
                this.setState({
                  fieldToFocus: this.newAttributeField.current,
                });
              } else {
                // if we submit with empty value -> focus next element (either next method field or newMethodfield)
                if (methodRefs && methodRefs.length > 0) {
                  this.setState({
                    fieldToFocus: methodRefs[0],
                  });
                } else {
                  this.setState({
                    fieldToFocus: this.newMethodField.current,
                  });
                }
              }
            }}
            onKeyDown={(event) => {
              // workaround when 'tab' key is pressed:
              // prevent default and execute blur manually without switching to next tab index
              // then set focus to newAttributeField field again (componentDidUpdate)
              if (event.key === 'Tab' && event.currentTarget.value) {
                event.preventDefault();
                event.currentTarget.blur();
                this.setState({
                  fieldToFocus: this.newAttributeField.current,
                });
              }
            }}
          /> */}
        </section>
        {/* <section>
          <Divider />
          <Header>{this.props.translate('popup.methods')}</Header>
          {methods.map((method, index) => (
            <UmlAttributeUpdate
              id={method.id}
              key={method.id}
              value={method.name}
              onChange={this.props.update}
              onSubmitKeyUp={() =>
                index === methods.length - 1
                  ? this.newMethodField.current?.focus()
                  : this.setState({
                      fieldToFocus: methodRefs[index + 1],
                    })
              }
              onDelete={this.delete}
              onRefChange={(ref) => (methodRefs[index] = ref)}
              element={method}
            />
          ))}
          <Textfield
            ref={this.newMethodField}
            outline
            value=""
            onSubmit={this.create(UMLObjectMethod)}
            onSubmitKeyUp={() =>
              this.setState({
                fieldToFocus: this.newMethodField.current,
              })
            }
            onKeyDown={(event) => {
              // workaround when 'tab' key is pressed:
              // prevent default and execute blur manually without switching to next tab index
              // then set focus to newMethodField field again (componentDidUpdate)
              if (event.key === 'Tab' && event.currentTarget.value) {
                event.preventDefault();
                event.currentTarget.blur();
                this.setState({
                  fieldToFocus: this.newMethodField.current,
                });
              }
            }}
          />
        </section> */}
      </div>
    );
  }

  private create = (Clazz: typeof UMLObjectAttribute | typeof UMLObjectMethod) => (value: string) => {
    const { element, create } = this.props;
    const member = new Clazz();
    member.name = value;
    create(member, element.id);
  };

  private rename = (id: string) => (name: string) => {
    this.props.update(id, { name });
  };

  private delete = (id: string) => () => {
    this.props.delete(id);
  };
}

interface OwnProps {
  element: UMLObjectName;
}

type StateProps = {};

interface DispatchProps {
  create: typeof UMLElementRepository.create;
  update: typeof UMLElementRepository.update;
  delete: typeof UMLElementRepository.delete;
  getById: (id: string) => UMLElement | null;
}

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(null, {
    create: UMLElementRepository.create,
    update: UMLElementRepository.update,
    delete: UMLElementRepository.delete,
    getById: UMLElementRepository.getById as any as AsyncDispatch<typeof UMLElementRepository.getById>,
  }),
);

export const UMLObjectNameUpdate = enhance(ObjectNameComponent);
