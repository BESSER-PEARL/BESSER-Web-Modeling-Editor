import React, { useState } from 'react';
import styled from 'styled-components';
import { Button } from '../../../components/controls/button/button';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { StylePane } from '../../../components/style-pane/style-pane';
import { IUMLElement } from '../../../services/uml-element/uml-element';
import { diagramBridge } from '../../../services/diagram-bridge/diagram-bridge-service';

// Define TextfieldValue type locally as it's not exported from textfield
type TextfieldValue = string | number;
const COMPARATORS = ['<', '<=', '==', '>=', '>'] as const;
type Comparator = typeof COMPARATORS[number];

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

type Props = {
  id: string;
  onRefChange: (instance: Textfield<any>) => void;
  value: string;
  onChange: (id: string, values: { name?: string; icon?: string; fillColor?: string; textColor?: string; lineColor?: string }) => void;
  onSubmitKeyUp: () => void;
  onDelete: (id: string) => () => void;
  element: IUMLElement;
};

const UMLUserModelAttributeUpdate = ({ id, onRefChange, value, onChange, onSubmitKeyUp, onDelete, element }: Props) => {
  const [colorOpen, setColorOpen] = useState(false);

  const toggleColor = () => setColorOpen((open) => !open);

  const getAttributeId = () => (element as any).attributeId || '';

  const getAttributeType = (): string => {
    const attrId = getAttributeId();
    if (!attrId) return '';
    const data = diagramBridge.getClassDiagramData();
    const attr = data?.elements?.[attrId];
    if (attr && typeof attr.attributeType === 'string') {
      return attr.attributeType.toLowerCase();
    }
    return '';
  };

  const isIntegerType = () => {
    const t = getAttributeType();
    return t === 'int' || t === 'integer' || t === 'number';
  };

  const normalizeComparator = (raw: string): Comparator => (raw === '=' ? '==' : (COMPARATORS.includes(raw as Comparator) ? (raw as Comparator) : '=='));

  const parseAttributeValue = (fullValue: string): { name: string; comparator: Comparator; value: string } => {
    const comparatorMatch = fullValue.match(/^(.*?)(?:\s*(<=|>=|==|=|<|>)\s*)(.*)$/);
    if (comparatorMatch) {
      return {
        name: comparatorMatch[1].trim(),
        comparator: normalizeComparator(comparatorMatch[2]),
        value: comparatorMatch[3],
      };
    }
    return { name: '', comparator: '==', value: fullValue };
  };

  const { name: attributeName, comparator, value: attributeValue } = parseAttributeValue(value);

  const formatAttribute = (attributeName: string, op: Comparator, newValue: TextfieldValue) => `${attributeName.trim()} ${op} ${newValue}`;

  const handleValueChange = (newValue: TextfieldValue) => {
    if (attributeName) {
      onChange(id, { name: formatAttribute(attributeName, comparator, newValue) });
    } else {
      onChange(id, { name: String(newValue) });
    }
  };

  const handleComparatorChange = (newComparator: Comparator) => {
    if (attributeName) {
      onChange(id, { name: formatAttribute(attributeName, newComparator, attributeValue) });
    }
  };

  const handleDelete = () => onDelete(id)();
  const renderComparatorInput = attributeName && isIntegerType();

  if (attributeName) {
    return (
      <>
        <Flex>
          <AttributeInputContainer>
            <AttributeNameLabel>{attributeName} {renderComparatorInput ? '' : '='} </AttributeNameLabel>
            {renderComparatorInput && (
              <select
                style={{ marginRight: 6 }}
                value={comparator}
                onChange={(e) => handleComparatorChange(e.target.value as Comparator)}
              >
                {COMPARATORS.map((op) => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
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
        <Textfield ref={onRefChange} gutter value={value} onChange={(newName) => onChange(id, { name: newName })} onSubmitKeyUp={onSubmitKeyUp} />
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
