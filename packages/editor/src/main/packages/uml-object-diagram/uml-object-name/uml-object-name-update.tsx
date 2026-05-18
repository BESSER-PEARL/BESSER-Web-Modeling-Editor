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
import { invokeMethod, RuntimeInvokeError } from '../../../services/runtime/runtime-invoke';
import { UMLObjectAttribute } from '../uml-object-attribute/uml-object-attribute';
import { UMLObjectMethod } from '../uml-object-method/uml-object-method';
import { UMLObjectName } from './uml-object-name';
import UMLObjectAttributeUpdate from '../uml-object-attribute/uml-object-attribute-update';
import { UserModelElementType } from '../../user-modeling';
import { UMLUserModelAttribute } from '../../user-modeling/uml-user-model-attribute/uml-user-model-attribute';
import UMLUserModelAttributeUpdate from '../../user-modeling/uml-user-model-attribute/uml-user-model-attribute-update';

// ---------------------------------------------------------------------------
// Method invocation types — kept minimal. Matches the editor JSON shape
// (UMLClassMethod elements) since that's what the backend converter
// expects and what diagramBridge exposes today.
// ---------------------------------------------------------------------------
interface ExecutableMethod {
  id: string;
  name: string;              // signature as written in the diagram, e.g. ``step(dt: float)``
  code: string;
  implementationType: string;
  parameters: Array<{ name: string; type: string }>;
}

interface ParamPromptState {
  method: ExecutableMethod;
  values: Record<string, string>;
}

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

// Row of method buttons under "Run Methods". Wraps so a long method list
// doesn't push the inspector wider than the popup container.
const MethodButtonsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
`;

const MethodFeedback = styled.div<{ kind: 'ok' | 'error' }>`
  margin-top: 6px;
  font-size: 12px;
  color: ${(p) => (p.kind === 'error' ? '#c1121f' : '#555')};
  word-break: break-word;
`;

const ParamPromptBox = styled.div`
  margin-top: 8px;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fafafa;
`;

const ParamRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-top: 4px;
`;

const ParamPromptActions = styled.div`
  display: flex;
  gap: 6px;
  margin-top: 8px;
  justify-content: flex-end;
`;

// ---------------------------------------------------------------------------
// Attribute-name parsing — UMLObjectAttribute stores its slot as a free-form
// string like ``"+ level: float = 0.0"``. After a runtime invoke we need to
// rewrite the value while preserving visibility marker + type annotation
// so the rest of the UI keeps rendering correctly.
// ---------------------------------------------------------------------------
interface ParsedAttrName {
  visibilityPrefix: string;     // ``+ `` / ``- `` / etc, including trailing space, or empty
  name: string;
  typeAnnotation: string | null; // ``float`` / ``int`` / null
}

const parseAttrName = (raw: string): ParsedAttrName => {
  let remainder = raw ?? '';
  let visibilityPrefix = '';
  const visibilityMatch = remainder.match(/^([+\-#~])\s+/);
  if (visibilityMatch) {
    visibilityPrefix = visibilityMatch[0];
    remainder = remainder.slice(visibilityMatch[0].length);
  }
  const eqIdx = remainder.indexOf('=');
  const decl = eqIdx >= 0 ? remainder.slice(0, eqIdx).trim() : remainder.trim();
  const colonIdx = decl.indexOf(':');
  if (colonIdx >= 0) {
    return {
      visibilityPrefix,
      name: decl.slice(0, colonIdx).trim(),
      typeAnnotation: decl.slice(colonIdx + 1).trim() || null,
    };
  }
  return { visibilityPrefix, name: decl.trim(), typeAnnotation: null };
};

const composeAttrName = (parsed: ParsedAttrName, value: unknown): string => {
  const valueStr = value === null || value === undefined ? '' : String(value);
  const typeSegment = parsed.typeAnnotation ? `: ${parsed.typeAnnotation}` : '';
  return `${parsed.visibilityPrefix}${parsed.name}${typeSegment} = ${valueStr}`;
};

// ---------------------------------------------------------------------------
// Method signature parsing — ``step(dt: float, n: int)`` → parameter list.
// Falls back to ``[]`` if the signature is malformed; the backend will then
// reject the call with a clear TypeError if args are required.
// ---------------------------------------------------------------------------
/**
 * Strip the leading UML visibility marker (``+``, ``-``, ``#``, ``~``) +
 * spaces and any signature ``(...)`` suffix from a method-element name,
 * leaving just the bare identifier. The backend's class-diagram parser
 * normalises method names this way too, so the materialized class
 * exposes ``increase`` rather than ``"+ increase"`` — sending the raw
 * editor string would AttributeError.
 */
const extractMethodIdentifier = (rawName: string): string => {
  const stripped = (rawName ?? '').replace(/^[+\-#~]\s+/, '');
  const openParen = stripped.indexOf('(');
  return (openParen >= 0 ? stripped.slice(0, openParen) : stripped).trim();
};

const parseSignatureParameters = (signature: string): Array<{ name: string; type: string }> => {
  const open = signature.indexOf('(');
  const close = signature.lastIndexOf(')');
  if (open < 0 || close < 0 || close <= open) return [];
  const inner = signature.slice(open + 1, close).trim();
  if (!inner) return [];
  return inner
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const colon = p.indexOf(':');
      if (colon >= 0) {
        return { name: p.slice(0, colon).trim(), type: p.slice(colon + 1).trim() || 'any' };
      }
      return { name: p, type: 'any' };
    });
};

const coerceParamValue = (
  type: string,
  raw: string,
): { ok: true; value: unknown } | { ok: false; error: string } => {
  const t = type.toLowerCase();
  if (raw === '') return { ok: true, value: null };
  if (t.includes('int')) {
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return { ok: false, error: `Expected integer, got '${raw}'` };
    return { ok: true, value: n };
  }
  if (t.includes('float') || t.includes('double') || t.includes('number')) {
    const n = parseFloat(raw);
    if (Number.isNaN(n)) return { ok: false, error: `Expected number, got '${raw}'` };
    return { ok: true, value: n };
  }
  if (t.includes('bool')) {
    const v = raw.toLowerCase();
    if (['true', '1', 'yes'].includes(v)) return { ok: true, value: true };
    if (['false', '0', 'no'].includes(v)) return { ok: true, value: false };
    return { ok: false, error: `Expected true/false, got '${raw}'` };
  }
  return { ok: true, value: raw };
};

type State = {
  fieldToFocus?: Textfield<string> | null;
  colorOpen: boolean;
  /** Name of the method currently being awaited (or null). Used to
   *  disable just that button + show its spinner label. */
  invokingMethod: string | null;
  /** Last successful result from runtime.invoke — surfaced in-line as
   *  "method → value" so users see the method return value (when
   *  non-null) without opening a separate panel. */
  lastInvoke: { method: string; result: unknown } | null;
  /** Last error message from runtime.invoke — surfaced verbatim. */
  invokeError: string | null;
  /** Open parameter-collection panel for methods that take args. */
  paramPrompt: ParamPromptState | null;
};

const getInitialState = (): State => ({
  fieldToFocus: undefined,
  colorOpen: false,
  invokingMethod: null,
  lastInvoke: null,
  invokeError: null,
  paramPrompt: null,
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
      selectedClass.attributes.forEach((attr: { id: string, name: string, type?: string, defaultValue?: any }) => {
        const attribute = new UMLObjectAttribute();
        const defaultVal = attr.defaultValue !== undefined && attr.defaultValue !== null
          ? String(attr.defaultValue)
          : '';
        attribute.name = `${attr.name} = ${defaultVal}`;
        // Store the attribute ID and type from the library
        (attribute as any).attributeId = attr.id;
        if (attr.type) {
          attribute.attributeType = attr.type;
        }
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
    const isUserModelElement = element.type === (UserModelElementType as any).UserModelName;
    const children = element.ownedElements.map((id) => getById(id)).filter(notEmpty);
    const attributes = children.filter((child): child is UMLObjectAttribute | UMLUserModelAttribute => {
      if (isUserModelElement) {
        return child.type === (UserModelElementType as any).UserModelAttribute;
      }
      return child instanceof UMLObjectAttribute;
    });
    const methods = children.filter((child) => child instanceof UMLObjectMethod);
    const attributeRefs: (Textfield<string> | null)[] = [];
    const methodRefs: (Textfield<string> | null)[] = [];
    const availableClasses = this.getAvailableClasses();
    const showClassSelection = !isUserModelElement && availableClasses.length > 0;

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
          </Flex>{showClassSelection && (
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
          {attributes.map((attribute, index) => {
            const AttributeComponent: React.ComponentType<any> = isUserModelElement
              ? UMLUserModelAttributeUpdate
              : UMLObjectAttributeUpdate;
            return (
            <AttributeComponent
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
              onRefChange={(ref: Textfield<string> | null) => {
                attributeRefs[index] = ref;
              }}
              element={attribute}
            />
          );
          })}
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
        {(() => {
          // Runtime invocation section — only renders when the object's
          // class has at least one executable method. Keeps the popup
          // tidy for objects of classes that don't (yet) declare any.
          const executable = this.getExecutableMethods();
          if (executable.length === 0) return null;
          const { invokingMethod, lastInvoke, invokeError, paramPrompt } = this.state;
          return (
            <section>
              <Divider />
              <Header>Run Methods</Header>
              <MethodButtonsRow>
                {executable.map((m) => {
                  const identifier = extractMethodIdentifier(m.name);
                  return (
                    <Button
                      key={m.id}
                      color="primary"
                      onClick={() => this.handleMethodClick(m)}
                      disabled={invokingMethod !== null}
                      title={
                        m.parameters.length === 0
                          ? `Run ${identifier}()`
                          : `Run ${identifier}(${m.parameters
                              .map((p) => `${p.name}: ${p.type}`)
                              .join(', ')})`
                      }
                    >
                      {invokingMethod === m.id
                        ? `${identifier}…`
                        : `▶ ${identifier}${m.parameters.length > 0 ? ` (${m.parameters.length})` : ''}`}
                    </Button>
                  );
                })}
              </MethodButtonsRow>

              {paramPrompt && (
                <ParamPromptBox>
                  <Body>
                    Invoke{' '}
                    <strong>
                      {extractMethodIdentifier(paramPrompt.method.name)}(
                      {paramPrompt.method.parameters.map((p) => `${p.name}: ${p.type}`).join(', ')})
                    </strong>
                  </Body>
                  {paramPrompt.method.parameters.map((p) => (
                    <ParamRow key={p.name}>
                      <Body style={{ minWidth: 90 }}>
                        {p.name}
                        <span style={{ color: '#888', fontSize: 11, marginLeft: 4 }}>
                          ({p.type})
                        </span>
                      </Body>
                      <Textfield
                        value={paramPrompt.values[p.name] ?? ''}
                        onChange={(v: string) => this.setParamValue(p.name, v)}
                      />
                    </ParamRow>
                  ))}
                  <ParamPromptActions>
                    <Button color="link" onClick={this.cancelParamPrompt}>
                      Cancel
                    </Button>
                    <Button color="primary" onClick={this.submitParamPrompt}>
                      Invoke
                    </Button>
                  </ParamPromptActions>
                </ParamPromptBox>
              )}

              {invokeError && <MethodFeedback kind="error">{invokeError}</MethodFeedback>}
              {!invokeError && lastInvoke && lastInvoke.result !== null && lastInvoke.result !== undefined && (
                <MethodFeedback kind="ok">
                  {extractMethodIdentifier(lastInvoke.method)} →{' '}
                  <code>{String(lastInvoke.result)}</code>
                </MethodFeedback>
              )}
            </section>
          );
        })()}
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

  // -------------------------------------------------------------------
  // Runtime method invocation — Phase 1.0.7
  // -------------------------------------------------------------------
  /** Methods declared on the selected object's class that the backend
   *  runtime kernel can execute (implementation_type=code + non-empty
   *  body). Walks the class diagram via ``diagramBridge``. */
  private getExecutableMethods = (): ExecutableMethod[] => {
    const { element } = this.props;
    const classId = (element as any).classId as string | undefined;
    if (!classId) return [];
    const classData = diagramBridge.getClassDiagramData();
    if (!classData || !classData.elements) return [];
    const classElement = classData.elements[classId];
    if (!classElement || !Array.isArray(classElement.methods)) return [];
    const methods: ExecutableMethod[] = [];
    for (const methodId of classElement.methods as string[]) {
      const m = classData.elements[methodId];
      if (!m) continue;
      const impl = String(m.implementationType ?? 'none').toLowerCase();
      const code = String(m.code ?? '').trim();
      if (impl !== 'code' || !code) continue;
      methods.push({
        id: methodId,
        name: String(m.name ?? ''),
        code,
        implementationType: impl,
        parameters: parseSignatureParameters(String(m.name ?? '')),
      });
    }
    return methods;
  };

  /** Build the ``classDiagram`` part of the invoke payload. */
  private buildClassDiagramPayload = (): { title: string; model: any } => {
    const classData = diagramBridge.getClassDiagramData() ?? {
      elements: {},
      relationships: {},
    };
    return {
      title: 'Classes',
      model: {
        type: 'ClassDiagram',
        elements: classData.elements ?? {},
        relationships: classData.relationships ?? {},
      },
    };
  };

  /** Build the ``objectDiagram`` part — use the canonical serialized
   *  model that mirrors what the validate-diagram / export endpoints
   *  receive. Spreading raw ``state.elements`` doesn't work: those are
   *  UMLElement instances with private fields and getters, not the
   *  JSON shape the backend converter parses. */
  private buildObjectDiagramPayload = (): { title: string; model: any } => {
    const { serializedModel } = this.props;
    return {
      title: 'Objects',
      model: serializedModel,
    };
  };

  /** Apply the mutated attribute values returned from the kernel onto
   *  the object's child ObjectAttribute slots so the user sees them
   *  update in-place without refreshing or saving. */
  private mergeUpdatedAttributes = (updated: Record<string, unknown>) => {
    const { element, getById, update } = this.props;
    const children = element.ownedElements
      .map((id) => getById(id))
      .filter(notEmpty)
      .filter((c): c is UMLObjectAttribute => c instanceof UMLObjectAttribute);
    for (const attr of children) {
      const parsed = parseAttrName(attr.name);
      if (parsed.name in updated) {
        update(attr.id, { name: composeAttrName(parsed, updated[parsed.name]) });
      }
    }
  };

  /** Invoke a method with the given args; surface the outcome inline. */
  private runInvoke = async (method: ExecutableMethod, args: Record<string, unknown>) => {
    const { element } = this.props;
    const classId = (element as any).classId as string | undefined;
    if (!classId) {
      this.setState({ invokeError: 'Object has no associated class.' });
      return;
    }
    const classData = diagramBridge.getClassDiagramData();
    const classElement = classData?.elements?.[classId];
    const className = classElement?.name;
    if (!className) {
      this.setState({ invokeError: `Could not resolve class for classId ${classId}.` });
      return;
    }
    // The runtime kernel finds the instance by its diagram name —
    // matches what the editor's ObjectName.name carries.
    const instanceName = element.name || '';
    if (!instanceName) {
      this.setState({ invokeError: 'Object has no name.' });
      return;
    }
    this.setState({ invokingMethod: method.id, invokeError: null });
    try {
      const response = await invokeMethod({
        classDiagram: this.buildClassDiagramPayload(),
        objectDiagram: this.buildObjectDiagramPayload(),
        className,
        instanceName,
        methodName: extractMethodIdentifier(method.name),
        args,
      });
      this.mergeUpdatedAttributes(response.updated_attributes);
      this.setState({
        invokingMethod: null,
        lastInvoke: { method: method.name, result: response.result },
        paramPrompt: null,
      });
    } catch (e) {
      const detail =
        e instanceof RuntimeInvokeError ? e.detail : (e as Error).message ?? 'Invoke failed';
      this.setState({ invokingMethod: null, invokeError: detail });
    }
  };

  private handleMethodClick = (method: ExecutableMethod) => {
    if (method.parameters.length === 0) {
      void this.runInvoke(method, {});
    } else {
      const seedValues: Record<string, string> = {};
      for (const p of method.parameters) seedValues[p.name] = '';
      this.setState({
        paramPrompt: { method, values: seedValues },
        invokeError: null,
      });
    }
  };

  private setParamValue = (paramName: string, raw: string) => {
    this.setState((prev) => {
      if (!prev.paramPrompt) return prev;
      return {
        ...prev,
        paramPrompt: {
          ...prev.paramPrompt,
          values: { ...prev.paramPrompt.values, [paramName]: raw },
        },
      };
    });
  };

  private submitParamPrompt = () => {
    const prompt = this.state.paramPrompt;
    if (!prompt) return;
    const args: Record<string, unknown> = {};
    for (const param of prompt.method.parameters) {
      const raw = prompt.values[param.name] ?? '';
      const coerced = coerceParamValue(param.type, raw);
      if (!coerced.ok) {
        this.setState({ invokeError: `${param.name}: ${coerced.error}` });
        return;
      }
      args[param.name] = coerced.value;
    }
    void this.runInvoke(prompt.method, args);
  };

  private cancelParamPrompt = () => {
    this.setState({ paramPrompt: null, invokeError: null });
  };

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

// Subscribe to ``state.elements`` so the popup re-renders whenever a child
// attribute's ``name`` (or any other field) changes in the store. Without
// this subscription, the popup only receives the initial element snapshot
// from ``UpdatePane`` and keeps passing a stale ``value`` prop into each
// attribute's ``Textfield`` — so on Enter, the Textfield resets its local
// draft and falls back to the stale (empty) prop, making the just-typed
// value visually disappear even though Redux already has it. The
// ``UMLClassifierUpdate`` popup subscribes to ``state.elements`` for the
// same reason.
type StateProps = {
  elements: ModelState['elements'];
  // ``relationships`` is needed to build the object-diagram payload the
  // runtime kernel consumes (the backend's converter walks both).
  relationships: ModelState['relationships'];
  // The canonical serialized model — what the backend's converters
  // expect. Built via ``ModelState.toModel`` (same path the webapp's
  // ``editor.model`` getter uses for validate-diagram / export). Raw
  // ``state.elements`` carries UMLElement instances with private
  // fields and getters, NOT the JSON shape the converter expects, so
  // we can't reuse those directly for the API payload.
  serializedModel: ReturnType<typeof ModelState.toModel>;
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
    (state) => ({
      elements: state.elements,
      relationships: state.relationships,
      serializedModel: ModelState.toModel(state),
    }),
    {
      create: UMLElementRepository.create,
      update: UMLElementRepository.update,
      delete: UMLElementRepository.delete,
      getById: UMLElementRepository.getById as any as AsyncDispatch<typeof UMLElementRepository.getById>,
    },
  ),
);

export const UMLObjectNameUpdate = enhance(ObjectNameComponent);
