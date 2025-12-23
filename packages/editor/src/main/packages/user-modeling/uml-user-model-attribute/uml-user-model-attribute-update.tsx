import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Button } from '../../../components/controls/button/button';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Dropdown } from '../../../components/controls/dropdown/dropdown';
import { StylePane } from '../../../components/style-pane/style-pane';
import { IUMLElement } from '../../../services/uml-element/uml-element';
import { diagramBridge } from '../../../services/diagram-bridge/diagram-bridge-service';
import {
  IUMLUserModelAttribute,
  USER_MODEL_ATTRIBUTE_COMPARATORS,
  UserModelAttributeComparator,
  normalizeUserModelAttributeComparator,
} from './uml-user-model-attribute';

// Define TextfieldValue type locally as it's not exported from textfield
type TextfieldValue = string | number;
const COMPARATORS = USER_MODEL_ATTRIBUTE_COMPARATORS;
type Comparator = UserModelAttributeComparator;

const Flex = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
`;

const AttributeInputContainer = styled.div`
  display: flex;
  align-items: center;
  flex-grow: 1;
  margin-right: 8px;
`;

const AttributeNameLabel = styled.span`
  font-family: inherit;
  font-size: inherit;
  color: inherit;
  margin-right: 4px;
  white-space: nowrap;
`;

const ValueTextfield = styled(Textfield)`
  flex-grow: 1;
  min-width: 60px;
`;

const ComparatorDropdown = styled(Dropdown)`
  margin-right: 6px;
`;

type Props = {
  id: string;
  onRefChange: (instance: Textfield<any>) => void;
  value: string;
  onChange: (
    id: string,
    values: {
      name?: string;
      icon?: string;
      fillColor?: string;
      textColor?: string;
      lineColor?: string;
      attributeOperator?: Comparator;
    },
  ) => void;
  onSubmitKeyUp: () => void;
  onDelete: (id: string) => () => void;
  element: IUMLElement;
};

const UMLUserModelAttributeUpdate = ({ id, onRefChange, value, onChange, onSubmitKeyUp, onDelete, element }: Props) => {
  const [colorOpen, setColorOpen] = useState(false);
  const attributeElement = element as IUMLUserModelAttribute;

  const toggleColor = () => setColorOpen((open) => !open);

  const getAttributeId = () => (element as any).attributeId || '';

  const getAttributeDefinition = () => {
    const attrId = getAttributeId();
    if (!attrId) {
      return null;
    }
    const data = diagramBridge.getClassDiagramData();
    return data?.elements?.[attrId] ?? null;
  };

  const getAttributeType = (): string => {
    const attr = getAttributeDefinition();
    if (attr && typeof attr.attributeType === 'string') {
      return attr.attributeType.toLowerCase();
    }
    return '';
  };

  const isIntegerType = () => {
    const t = getAttributeType();
    return t === 'int' || t === 'integer' || t === 'number';
  };

  const parseAttributeValue = (fullValue: string): { name: string; comparator: Comparator; value: string } => {
    const comparatorMatch = fullValue.match(/^(.*?)(?:\s*(<=|>=|==|=|<|>)\s*)(.*)$/);
    if (comparatorMatch) {
      return {
        name: comparatorMatch[1].trim(),
        comparator: normalizeUserModelAttributeComparator(comparatorMatch[2]),
        value: comparatorMatch[3],
      };
    }
    return { name: '', comparator: normalizeUserModelAttributeComparator(), value: fullValue };
  };

  const { name: attributeName, comparator, value: attributeValue } = parseAttributeValue(value);
  const storedComparator =
    typeof attributeElement.attributeOperator === 'string'
      ? normalizeUserModelAttributeComparator(attributeElement.attributeOperator)
      : undefined;
  const effectiveComparator = storedComparator ?? comparator;
  const [currentComparator, setCurrentComparator] = useState<Comparator>(effectiveComparator);

  useEffect(() => {
    setCurrentComparator(effectiveComparator);
  }, [effectiveComparator]);

  const attributeDefinition = getAttributeDefinition();
  const resolvedAttributeName = attributeName || attributeDefinition?.name || '';
  const baseAttributeName = resolvedAttributeName || attributeName;

  const formatAttribute = (attributeName: string, op: Comparator, newValue: TextfieldValue) => `${attributeName.trim()} ${op} ${newValue}`;

  const handleValueChange = (newValue: TextfieldValue) => {
    if (baseAttributeName) {
      onChange(id, { name: formatAttribute(baseAttributeName, currentComparator, newValue), attributeOperator: currentComparator });
    } else {
      onChange(id, { name: String(newValue), attributeOperator: currentComparator });
    }
  };

  const handleComparatorChange = (newComparator: Comparator) => {
    setCurrentComparator(newComparator);
    if (baseAttributeName) {
      onChange(id, {
        name: formatAttribute(baseAttributeName, newComparator, attributeValue),
        attributeOperator: newComparator,
      });
    } else {
      onChange(id, { attributeOperator: newComparator });
    }
  };

  const handleDelete = () => onDelete(id)();
  const renderComparatorInput = Boolean(baseAttributeName) && isIntegerType();

  const labelText = resolvedAttributeName || attributeName;

  if (labelText) {
    return (
      <>
        <Flex>
          <AttributeInputContainer>
            <AttributeNameLabel>
              {labelText} {renderComparatorInput ? '' : '='}{' '}
            </AttributeNameLabel>
            {renderComparatorInput && (
              <ComparatorDropdown
                value={currentComparator}
                onChange={(value) => handleComparatorChange(value as Comparator)}
                size="sm"
              >
                {COMPARATORS.map((op) => (
                  <Dropdown.Item key={op} value={op}>
                    {op}
                  </Dropdown.Item>
                ))}
              </ComparatorDropdown>
            )}
            <ValueTextfield
              ref={onRefChange}
              gutter
              value={attributeValue}
              onChange={handleValueChange}
              onSubmitKeyUp={onSubmitKeyUp}
              placeholder="value"
            />
          </AttributeInputContainer>
          <ColorButton onClick={toggleColor} />
          <Button color="link" tabIndex={-1} onClick={handleDelete}>
            <TrashIcon />
          </Button>
        </Flex>
        <StylePane open={colorOpen} element={element} onColorChange={onChange} showIcon fillColor textColor />
      </>
    );
  }

  return (
    <>
      <Flex>
        <Textfield
          ref={onRefChange}
          gutter
          value={value}
          onChange={(newName) => onChange(id, { name: newName, attributeOperator: currentComparator })}
          onSubmitKeyUp={onSubmitKeyUp}
        />
        <ColorButton onClick={toggleColor} />
        <Button color="link" tabIndex={-1} onClick={handleDelete}>
          <TrashIcon />
        </Button>
      </Flex>
      <StylePane open={colorOpen} element={element} onColorChange={onChange} showIcon fillColor textColor />
    </>
  );
};

export default UMLUserModelAttributeUpdate;
