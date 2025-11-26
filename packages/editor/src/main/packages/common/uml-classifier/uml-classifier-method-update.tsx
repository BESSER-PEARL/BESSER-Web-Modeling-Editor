import React, { useState } from 'react';
import styled from 'styled-components';
import { Button } from '../../../components/controls/button/button';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Dropdown } from '../../../components/controls/dropdown/dropdown';
import { StylePane } from '../../../components/style-pane/style-pane';
import { IUMLElement } from '../../../services/uml-element/uml-element';
import { Controlled as CodeMirror } from 'react-codemirror2';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material.css';
import 'codemirror/mode/python/python';

const Flex = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px;
`;

const MethodRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
`;

const ControlsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const VisibilityDropdown = styled(Dropdown)`
  min-width: 80px;
  flex-shrink: 0;
`;

const NameField = styled(Textfield)`
  flex: 1;
  min-width: 0;
`;

const CodeButton = styled(Button)`
  padding: 4px 8px;
  font-size: 12px;
  min-width: 60px;
`;

const MethodNameLabel = styled.span`
  flex: 1;
  min-width: 0;
  padding: 4px 8px;
  font-size: 13px;
  color: ${(props) => props.theme.color.primary || '#007bff'};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CodeEditorWrapper = styled.div`
  margin-top: 8px;
  border: 1px solid ${(props) => props.theme.color.gray};
  border-radius: 4px;
  overflow: hidden;
`;

const ResizableCodeMirrorWrapper = styled.div`
  resize: both;
  overflow: auto;
  min-height: 150px;
  max-height: 400px;
  box-sizing: border-box;

  .CodeMirror {
    height: 100% !important;
    width: 100%;
    min-height: 150px;
  }
`;

const CodeEditorHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background-color: ${(props) => props.theme.color.grayLight || '#f5f5f5'};
  border-bottom: 1px solid ${(props) => props.theme.color.gray};
`;

const CodeEditorTitle = styled.span`
  font-weight: bold;
  font-size: 12px;
`;

const VISIBILITY_OPTIONS = [
  { symbol: '+', value: 'public', label: '+' },
  { symbol: '-', value: 'private', label: '-' },
  { symbol: '#', value: 'protected', label: '#' },
  { symbol: '~', value: 'package', label: '~' },
];

type Props = {
  id: string;
  onRefChange: (instance: Textfield<any>) => void;
  value: string;
  code: string;
  onChange: (id: string, values: { name?: string; code?: string; fillColor?: string; textColor?: string; lineColor?: string }) => void;
  onSubmitKeyUp: () => void;
  onDelete: (id: string) => () => void;
  element: IUMLElement;
};

const UmlMethodUpdate = ({ id, onRefChange, value, code, onChange, onSubmitKeyUp, onDelete, element }: Props) => {
  const [colorOpen, setColorOpen] = useState(false);
  const [codeEditorOpen, setCodeEditorOpen] = useState(code ? true : false); // Auto-open if code exists
  const [localCode, setLocalCode] = useState(code || '');

  const toggleColor = () => {
    setColorOpen(!colorOpen);
  };

  const toggleCodeEditor = () => {
    if (!codeEditorOpen && !localCode) {
      // Initialize with a template when opening for the first time
      const methodName = parseMethod(value).name || 'method_name';
      // Extract just the method name without parameters for the template
      const cleanMethodName = methodName.split('(')[0].trim();
      setLocalCode(`def ${cleanMethodName}(self):\n    # Add your implementation here\n    pass\n`);
      // Update the code in the backend
      onChange(id, { code: `def ${cleanMethodName}(self):\n    # Add your implementation here\n    pass\n` });
    }
    setCodeEditorOpen(!codeEditorOpen);
  };

  const clearCode = () => {
    setLocalCode('');
    onChange(id, { code: '' });
    setCodeEditorOpen(false);
  };

  // Parse the method string: visibility name(params): returnType
  const parseMethod = (methodString: string) => {
    const trimmed = methodString.trim();
    let visibility = '+'; // default
    let name = '';
    
    // Check for visibility symbol at the start
    const visibilityMatch = trimmed.match(/^([+\-#~])\s*/);
    if (visibilityMatch) {
      visibility = visibilityMatch[1];
      name = trimmed.substring(visibilityMatch[0].length);
    } else {
      name = trimmed;
    }
    
    return { visibility, name };
  };

  const { visibility, name } = parseMethod(value);

  const handleVisibilityChange = (newVisibility: unknown) => {
    const visSymbol = VISIBILITY_OPTIONS.find(v => v.value === newVisibility)?.symbol || '+';
    const newValue = `${visSymbol} ${name}`;
    onChange(id, { name: newValue });
  };

  const handleNameChange = (newName: string | number) => {
    const nameStr = String(newName);
    const visSymbol = VISIBILITY_OPTIONS.find(v => v.value === visibility)?.symbol || visibility;
    const newValue = `${visSymbol} ${nameStr}`;
    onChange(id, { name: newValue });
  };

  const handleCodeChange = (editor: any, data: any, newCode: string) => {
    setLocalCode(newCode);
    onChange(id, { code: newCode });
  };

  const handleDelete = () => {
    onDelete(id)();
  };

  const visibilityValue = VISIBILITY_OPTIONS.find(v => v.symbol === visibility)?.value || 'public';
  const hasCode = localCode && localCode.trim().length > 0;

  return (
    <MethodRow>
      <ControlsRow>
        {/* Show signature fields only when NOT in code mode */}
        {!hasCode && (
          <>
            <VisibilityDropdown value={visibilityValue} onChange={handleVisibilityChange}>
              {VISIBILITY_OPTIONS.map(vis => (
                <Dropdown.Item key={vis.value} value={vis.value}>
                  {vis.label}
                </Dropdown.Item>
              ))}
            </VisibilityDropdown>
            <NameField 
              ref={onRefChange} 
              value={name} 
              onChange={handleNameChange} 
              onSubmitKeyUp={onSubmitKeyUp}
              placeholder="method(param: type): returnType"
            />
          </>
        )}
        {/* Show method name label when in code mode */}
        {hasCode && (
          <MethodNameLabel title="Method defined in code below">
            📝 {name.split('(')[0] || 'method'} (Python code)
          </MethodNameLabel>
        )}
        <CodeButton 
          color={hasCode ? "primary" : "link"} 
          onClick={toggleCodeEditor}
          title={hasCode ? "Edit Python code" : "Add Python code"}
        >
          {codeEditorOpen ? '▼ Code' : '▶ Code'}
        </CodeButton>
        <ColorButton onClick={toggleColor} />
        <Button color="link" tabIndex={-1} onClick={handleDelete}>
          <TrashIcon />
        </Button>
      </ControlsRow>
      
      {codeEditorOpen && (
        <CodeEditorWrapper>
          <CodeEditorHeader>
            <CodeEditorTitle>Python Implementation (full method definition)</CodeEditorTitle>
            <div>
              {hasCode && (
                <Button color="link" onClick={clearCode} style={{ padding: '2px 6px', fontSize: '10px', marginRight: '4px' }}>
                  Clear Code
                </Button>
              )}
              <Button color="link" onClick={toggleCodeEditor} style={{ padding: '2px 6px', fontSize: '10px' }}>
                Close
              </Button>
            </div>
          </CodeEditorHeader>
          <ResizableCodeMirrorWrapper>
            <CodeMirror
              value={localCode}
              options={{
                mode: 'python',
                theme: 'material',
                lineNumbers: true,
                tabSize: 4,
                indentWithTabs: false,
                indentUnit: 4,
              }}
              onBeforeChange={(editor, data, value) => {
                setLocalCode(value);
              }}
              onChange={handleCodeChange}
            />
          </ResizableCodeMirrorWrapper>
        </CodeEditorWrapper>
      )}
      
      <StylePane open={colorOpen} element={element} onColorChange={onChange} fillColor textColor />
    </MethodRow>
  );
};

export default UmlMethodUpdate;
