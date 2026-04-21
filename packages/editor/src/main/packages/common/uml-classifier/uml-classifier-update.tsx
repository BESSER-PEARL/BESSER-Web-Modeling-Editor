import React, { Component, ComponentClass, createRef } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import styled from 'styled-components';
import { Button } from '../../../components/controls/button/button';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { Divider } from '../../../components/controls/divider/divider';
import { ArrowDownIcon } from '../../../components/controls/icon/arrow-down';
import { ArrowUpIcon } from '../../../components/controls/icon/arrow-up';
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
  align-items: center;
  justify-content: space-between;
  gap: 4px;
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

const Section = styled.section`
  padding: 8px 0;
`;

const SectionHeader = styled(Header)`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.6;
  margin-bottom: 4px;
`;

const ReorderRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 2px;
`;

const ReorderControls = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  padding-top: 6px;
`;

const ReorderButton = styled(Button)`
  padding: 0 2px;
  line-height: 1;
  min-height: 12px;
  font-size: 10px;
  opacity: 0.55;
  &:hover:not(:disabled) {
    opacity: 1;
  }
  &:disabled {
    opacity: 0.15;
    cursor: default;
  }
`;

const ReorderChild = styled.div`
  flex: 1;
  min-width: 0;
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

  private moveMember = (memberId: string, direction: -1 | 1) => () => {
    const { element, elements, update } = this.props;
    const live = elements[element.id] as UMLClassifier | undefined;
    const ownedElements = live?.ownedElements ?? element.ownedElements;

    const isAttribute = (id: string) => elements[id]?.type === ClassElementType.ClassAttribute;
    const isMethod = (id: string) => elements[id]?.type === ClassElementType.ClassMethod;
    const sameKind = isAttribute(memberId) ? isAttribute : isMethod(memberId) ? isMethod : null;
    if (!sameKind) return;

    const siblings = ownedElements.filter(sameKind);
    const index = siblings.indexOf(memberId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= siblings.length) return;

    const reordered = [...siblings];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

    const attributes = ownedElements.filter(isAttribute);
    const methods = ownedElements.filter(isMethod);
    const others = ownedElements.filter((id) => !isAttribute(id) && !isMethod(id));
    const newAttributes = isAttribute(memberId) ? reordered : attributes;
    const newMethods = isMethod(memberId) ? reordered : methods;

    update<UMLClassifier>(element.id, {
      ownedElements: [...newAttributes, ...newMethods, ...others],
    } as Partial<UMLClassifier>);
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
        <Section>
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
        </Section>
        <Divider />
        <Section>
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
        </Section>
        <Divider />
        <Section>
          <SectionHeader>
            {isEnumeration
              ? this.props.translate('popup.literals')
              : this.props.translate('popup.attributes')}
          </SectionHeader>
          {attributes.map((attribute, index) => {
            const attrMember = attribute as UMLClassifierMember;
            const canMoveUp = index > 0;
            const canMoveDown = index < attributes.length - 1;
            return (
              <ReorderRow key={attribute.id}>
                <ReorderControls>
                  <ReorderButton
                    color="link"
                    tabIndex={-1}
                    disabled={!canMoveUp}
                    onClick={canMoveUp ? this.moveMember(attribute.id, -1) : undefined}
                    title="Move up"
                  >
                    <ArrowUpIcon width={10} height={10} />
                  </ReorderButton>
                  <ReorderButton
                    color="link"
                    tabIndex={-1}
                    disabled={!canMoveDown}
                    onClick={canMoveDown ? this.moveMember(attribute.id, 1) : undefined}
                    title="Move down"
                  >
                    <ArrowDownIcon />
                  </ReorderButton>
                </ReorderControls>
                <ReorderChild>
                  <UmlAttributeUpdate
                    id={attribute.id}
                    value={attribute.name}
                    visibility={attrMember.visibility}
                    attributeType={attrMember.attributeType}
                    isOptional={attrMember.isOptional}
                    isDerived={attrMember.isDerived}
                    defaultValue={attrMember.defaultValue}
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
                    elements={elements}
                  />
                </ReorderChild>
              </ReorderRow>
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
        </Section>
        {!isEnumeration && (
          <>
            <Divider />
            <Section>
              <SectionHeader>{this.props.translate('popup.methods')}</SectionHeader>
            {methods.map((method, index) => {
              const methodMember = method as UMLClassifierMember;
              const canMoveUp = index > 0;
              const canMoveDown = index < methods.length - 1;
              return (
                <ReorderRow key={method.id}>
                  <ReorderControls>
                    <ReorderButton
                      color="link"
                      tabIndex={-1}
                      disabled={!canMoveUp}
                      onClick={canMoveUp ? this.moveMember(method.id, -1) : undefined}
                      title="Move up"
                    >
                      <ArrowUpIcon />
                    </ReorderButton>
                    <ReorderButton
                      color="link"
                      tabIndex={-1}
                      disabled={!canMoveDown}
                      onClick={canMoveDown ? this.moveMember(method.id, 1) : undefined}
                      title="Move down"
                    >
                      <ArrowDownIcon />
                    </ReorderButton>
                  </ReorderControls>
                  <ReorderChild>
                    <UmlMethodUpdate
                      id={method.id}
                      value={methodMember.displayName}
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
                  </ReorderChild>
                </ReorderRow>
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
                title="Create method with code behaviour"
              >
                📝 Code
              </QuickCodeButton>
            </InputRow>
            </Section>
          </>
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
    const sanitized = value.replace(/[^a-zA-Z0-9_]/g, '');
    this.props.update(id, { name: sanitized });
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
    const { id: _ignoredId, ...values } = instance.serialize();
    update(element.id, values as Partial<UMLElement>);
  };

  private delete = (id: string) => () => {
    this.props.delete(id);
  };
}

export const UMLClassifierUpdate = enhance(ClassifierUpdate);