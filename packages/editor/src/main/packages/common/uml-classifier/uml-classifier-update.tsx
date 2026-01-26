import React, { Component, ComponentClass, createRef } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import styled from 'styled-components';
import { Button } from '../../../components/controls/button/button';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { Divider } from '../../../components/controls/divider/divider';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { Switch } from '../../../components/controls/switch/switch';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Header } from '../../../components/controls/typography/typography';
import { I18nContext } from '../../../components/i18n/i18n-context';
import { localized } from '../../../components/i18n/localized';
import { ModelState } from '../../../components/store/model-state';
import { StylePane } from '../../../components/style-pane/style-pane';
import { UMLElement } from '../../../services/uml-element/uml-element';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { AsyncDispatch } from '../../../utils/actions/actions';
import { notEmpty } from '../../../utils/not-empty';
import { ClassElementType } from '../../uml-class-diagram';
import { UMLClassAttribute } from '../../uml-class-diagram/uml-class-attribute/uml-class-attribute';
import { UMLClassMethod } from '../../uml-class-diagram/uml-class-method/uml-class-method';
import { UMLElementType } from '../../uml-element-type';
import { UMLElements } from '../../uml-elements';
import { UMLClassifier } from './uml-classifier';
import UmlAttributeUpdate from './uml-classifier-attribute-update';
import UmlMethodUpdate from './uml-classifier-method-update';
import { UMLClassifierMember } from './uml-classifier-member';
import { diagramBridge } from '../../../services/diagram-bridge';

const Flex = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
`;

const InputRow = styled.div`
  display: flex;
  gap: 4px;
  align-items: stretch;
`;

const QuickCodeButton = styled(Button)`
  white-space: nowrap;
  padding: 4px 12px;
  font-size: 12px;
`;

interface OwnProps {
  element: UMLClassifier;
}

type StateProps = {
  elements: ModelState['elements'];
};

interface DispatchProps {
  create: typeof UMLElementRepository.create;
  update: typeof UMLElementRepository.update;
  delete: typeof UMLElementRepository.delete;
  getById: (id: string) => UMLElement | null;
}

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(
    (state) => ({ elements: state.elements }),
    {
      create: UMLElementRepository.create,
      update: UMLElementRepository.update,
      delete: UMLElementRepository.delete,
      getById: UMLElementRepository.getById as any as AsyncDispatch<typeof UMLElementRepository.getById>,
    }
  ),
);

type State = {
  fieldToFocus?: Textfield<string> | null;
  colorOpen: boolean;
};

const getInitialState = (): State => ({
  fieldToFocus: undefined,
  colorOpen: false,
});

class ClassifierUpdate extends Component<Props, State> {
  state = getInitialState();
  newMethodField = createRef<Textfield<string>>();
  newAttributeField = createRef<Textfield<string>>();

  private toggleColor = () => {
    this.setState((state) => ({
      colorOpen: !state.colorOpen,
    }));
  };

  private onFieldChange = (id: string, values: { description?: string; uri?: string }) => {
    this.props.update(id, values);
  };

  componentDidUpdate(prevProps: Readonly<Props>, prevState: Readonly<{}>, snapshot?: any) {
    if (this.state.fieldToFocus) {
      this.state.fieldToFocus.focus();
      this.setState({ fieldToFocus: undefined });
    }
  }

  render() {
    const { element, getById, elements } = this.props;
    const children = element.ownedElements.map((id) => getById(id)).filter(notEmpty);
    const attributes = children.filter((child) => child instanceof UMLClassAttribute);
    const methods = children.filter((child) => child instanceof UMLClassMethod);
    const attributeRefs: (Textfield<string> | null)[] = [];
    const methodRefs: (Textfield<string> | null)[] = [];

    const isEnumeration = element.type === ClassElementType.Enumeration;

    // Get all enumerations from the current elements state
    const availableEnumerations = Object.values(elements)
      .filter((el) => el.type === ClassElementType.Enumeration)
      .map((el) => ({ value: el.name, label: el.name }));

    return (
      <div>
        <section>
          <Flex>
            <Textfield value={element.name} onChange={this.rename(element.id)} autoFocus />
            <ColorButton onClick={this.toggleColor} />
            <Button color="link" tabIndex={-1} onClick={this.delete(element.id)}>
              <TrashIcon />
            </Button>
          </Flex>
          <StylePane
            open={this.state.colorOpen}
            element={element}
            onColorChange={this.props.update}
            onFieldChange={this.onFieldChange}
            showDescription
            showUri
            showIcon
            fillColor
            lineColor
            textColor
          />
          <Divider />
        </section>
        <section>
          <Switch value={element.type as keyof typeof ClassElementType} onChange={this.toggle} color="primary">
            <Switch.Item value={ClassElementType.AbstractClass}>
              {this.props.translate('packages.ClassDiagram.AbstractClass')}
            </Switch.Item>
            {/* Switch item for Interface type is commented out because it is not supported yet
            <Switch.Item value={ClassElementType.Interface}>
              {this.props.translate('packages.ClassDiagram.Interface')}
            </Switch.Item>*/}
            <Switch.Item value={ClassElementType.Enumeration}>
              {this.props.translate('packages.ClassDiagram.Enumeration')}
            </Switch.Item>
          </Switch>
          <Divider />
        </section>
        <section>
          <Header>
            {isEnumeration 
              ? this.props.translate('popup.literals') 
              : this.props.translate('popup.attributes')}
          </Header>
          {attributes.map((attribute, index) => {
            const attrMember = attribute as UMLClassifierMember;
            return (
              <UmlAttributeUpdate
                id={attribute.id}
                key={attribute.id}
                value={attribute.name}
                visibility={attrMember.visibility}
                attributeType={attrMember.attributeType}
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
                isEnumeration={isEnumeration}
                availableEnumerations={availableEnumerations}
              />
            );
          })}
          <Textfield
            ref={this.newAttributeField}
            outline
            value=""
            placeholder={isEnumeration ? `+ literal` : `+ attribute: str`}
            onSubmit={this.create(UMLClassAttribute)}
            onSubmitKeyUp={(key: string, value: string) => {
              // if we have a value -> navigate to next field in case we want to create a new element
              if (value) {
                this.setState({
                  fieldToFocus: this.newAttributeField.current,
                });
              } else if (!isEnumeration) {
                // Only allow method navigation for non-enumerations
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
          />
        </section>
        {!isEnumeration && (
          <section>
            <Divider />
            <Header>{this.props.translate('popup.methods')}</Header>
            {methods.map((method, index) => {
              const methodMember = method as UMLClassifierMember;
              return (
                <UmlMethodUpdate
                  id={method.id}
                  key={method.id}
                  value={method.name}
                  code={methodMember.code || ''}
                  implementationType={methodMember.implementationType || 'none'}
                  stateMachineId={methodMember.stateMachineId || ''}
                  quantumCircuitId={methodMember.quantumCircuitId || ''}
                  availableStateMachines={diagramBridge.getStateMachineDiagrams()}
                  availableQuantumCircuits={diagramBridge.getQuantumCircuitDiagrams()}
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
              );
            })}
            <InputRow>
              <Textfield
                ref={this.newMethodField}
                outline
                value=""
                placeholder={`+ method(param: str): str or →`}
                onSubmit={this.create(UMLClassMethod)}
                onSubmitKeyUp={() =>
                  this.setState({
                    fieldToFocus: this.newMethodField.current,
                  })
                }
                onKeyDown={(event) => {
                  if (event.key === 'Tab' && event.currentTarget.value) {
                    event.preventDefault();
                    event.currentTarget.blur();
                    this.setState({
                      fieldToFocus: this.newMethodField.current,
                    });
                  }
                }}
                style={{ flex: 1 }}
              />
              <QuickCodeButton
                color="primary"
                onClick={this.createMethodWithCode}
                title="Create method with Python code editor"
              >
                📝 Code
              </QuickCodeButton>
            </InputRow>
          </section>
        )}
      </div>
    );
  }

  private create = (Clazz: typeof UMLClassAttribute | typeof UMLClassMethod) => (value: string) => {
    const { element, create } = this.props;
    // Prevent method creation for enumerations
    if (element.type === ClassElementType.Enumeration && Clazz === UMLClassMethod) {
      return;
    }
    const member = new Clazz();
    
    // For attributes, parse the input value and set separate properties
    if (Clazz === UMLClassAttribute) {
      const parsed = UMLClassifierMember.parseNameFormat(value);
      // Use the parsed name (without visibility symbol and type)
      member.name = parsed.name;
      (member as UMLClassifierMember).visibility = parsed.visibility;
      (member as UMLClassifierMember).attributeType = parsed.attributeType;
    } else {
      member.name = value;
    }
    
    create(member, element.id);
  };

  private createMethodWithCode = () => {
    const { element, create } = this.props;
    const method = new UMLClassMethod();
    const methodName = this.newMethodField.current?.props.value || 'new_method';
    method.name = methodName.trim() || '+ new_method()';
    // Add initial code template
    const cleanName = method.name.split('(')[0].replace(/^[+\-#~]\s*/, '').trim() || 'new_method';
    (method as any).code = `def ${cleanName}(self):\n    """Add your docstring here."""\n    # Add your implementation here\n    pass\n`;
    create(method, element.id);
    // Reset the component state by updating the key
    this.setState({ fieldToFocus: this.newMethodField.current });
  };

  private rename = (id: string) => (value: string) => {
    this.props.update(id, { name: value });
  };

  private toggle = (type: keyof typeof ClassElementType) => {
    const { element, update } = this.props;
    const newType: UMLElementType = element.type === type ? ClassElementType.Class : type;
    const instance = new UMLElements[newType]({
      id: element.id,
      name: element.name,
      type: element.type,
      owner: element.owner,
      bounds: element.bounds,
      ownedElements: element.ownedElements,
    });
    update(element.id, instance);
  };

  private delete = (id: string) => () => {
    this.props.delete(id);
  };
}

export const UMLClassifierUpdate = enhance(ClassifierUpdate);