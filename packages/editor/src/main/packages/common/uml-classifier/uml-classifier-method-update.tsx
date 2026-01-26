import React, { useState } from 'react';
import styled from 'styled-components';
import { Button } from '../../../components/controls/button/button';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Dropdown } from '../../../components/controls/dropdown/dropdown';
import { StylePane } from '../../../components/style-pane/style-pane';
import { IUMLElement } from '../../../services/uml-element/uml-element';
import { MethodImplementationType } from './uml-classifier-member';
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

const ImplementationTypeDropdown = styled(Dropdown)`
  min-width: 140px;
  flex-shrink: 0;
`;

const DiagramDropdown = styled(Dropdown)`
  min-width: 150px;
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

const ImplementationRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  padding: 4px 8px;
  background-color: ${(props) => props.theme.color.grayLight || '#f8f9fa'};
  border-radius: 4px;
`;

const ImplementationLabel = styled.span`
  font-size: 11px;
  color: ${(props) => props.theme.color.gray || '#666'};
`;

const DiagramRefLabel = styled.span`
  font-size: 12px;
  padding: 4px 8px;
  background-color: ${(props) => props.theme.color.primary || '#007bff'}20;
  color: ${(props) => props.theme.color.primary || '#007bff'};
  border-radius: 4px;
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

const IMPLEMENTATION_TYPE_OPTIONS: { value: MethodImplementationType; label: string; icon: string }[] = [
  { value: 'none', label: 'None (UML)', icon: '📋' },
  { value: 'code', label: 'Python Code', icon: '📝' },
  { value: 'state_machine', label: 'State Machine', icon: '🔄' },
  { value: 'quantum_circuit', label: 'Quantum Circuit', icon: '⚛️' },
];

// Available diagram references (these would be passed as props from the webapp in a real implementation)
export interface DiagramReference {
  id: string;
  name: string;
}

type Props = {
  id: string;
  onRefChange: (instance: Textfield<any>) => void;
  value: string;
  code: string;
  implementationType?: MethodImplementationType;
  stateMachineId?: string;
  quantumCircuitId?: string;
  availableStateMachines?: DiagramReference[];
  availableQuantumCircuits?: DiagramReference[];
  onChange: (id: string, values: { 
    name?: string; 
    code?: string; 
    implementationType?: MethodImplementationType;
    stateMachineId?: string;
    quantumCircuitId?: string;
    fillColor?: string; 
    textColor?: string; 
    lineColor?: string 
  }) => void;
  onSubmitKeyUp: () => void;
  onDelete: (id: string) => () => void;
  element: IUMLElement;
};

const UmlMethodUpdate = ({ 
  id, 
  onRefChange, 
  value, 
  code, 
  implementationType = 'none',
  stateMachineId = '',
  quantumCircuitId = '',
  availableStateMachines = [],
  availableQuantumCircuits = [],
  onChange, 
  onSubmitKeyUp, 
  onDelete, 
  element 
}: Props) => {
  const [colorOpen, setColorOpen] = useState(false);
  const [codeEditorOpen, setCodeEditorOpen] = useState(code ? true : false); // Auto-open if code exists
  const [localCode, setLocalCode] = useState(code || '');
  const [localImplType, setLocalImplType] = useState<MethodImplementationType>(
    implementationType || (code ? 'code' : 'none')
  );

  const toggleColor = () => {
    setColorOpen(!colorOpen);
  };

  const toggleCodeEditor = () => {
    if (!codeEditorOpen) {
      // Opening the code editor
      if (!localCode) {
        // Initialize with a template when opening for the first time
        const methodName = parseMethod(value).name || 'method_name';
        // Extract just the method name without parameters for the template
        const cleanMethodName = methodName.split('(')[0].trim() || 'new_method';
        const template = `def ${cleanMethodName}(self):\n    """Add your docstring here."""\n    # Add your implementation here\n    pass\n`;
        setLocalCode(template);
        onChange(id, { code: template });
      }
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
    
    // Extract method name from Python code
    const methodMatch = newCode.match(/def\s+(\w+)\s*\([^)]*\)/);
    if (methodMatch && methodMatch[1]) {
      const extractedMethodName = methodMatch[1];
      // Extract return type if exists
      const returnTypeMatch = newCode.match(/def\s+\w+\s*\([^)]*\)\s*->\s*([^:]+):/);
      const returnType = returnTypeMatch ? returnTypeMatch[1].trim() : '';
      
      // Extract parameters
      const paramsMatch = newCode.match(/def\s+\w+\s*\(([^)]*)\)/);
      let params = '';
      if (paramsMatch && paramsMatch[1]) {
        // Remove 'self' and clean up parameters
        const paramList = paramsMatch[1].split(',')
          .map(p => p.trim())
          .filter(p => p && p !== 'self');
        params = paramList.length > 0 ? paramList.join(', ') : '';
      }
      
      // Build the method signature for display
      const visSymbol = VISIBILITY_OPTIONS.find(v => v.value === visibility)?.symbol || '+';
      let signature = `${visSymbol} ${extractedMethodName}`;
      if (params || returnType) {
        signature += `(${params})`;
        if (returnType) {
          signature += `: ${returnType}`;
        }
      } else {
        signature += '()';
      }
      
      // Update both code and name
      onChange(id, { code: newCode, name: signature });
    } else {
      // No valid method found, just update code
      onChange(id, { code: newCode });
    }
  };

  const handleDelete = () => {
    onDelete(id)();
  };

  const handleImplementationTypeChange = (newType: unknown) => {
    const implType = newType as MethodImplementationType;
    setLocalImplType(implType);
    
    // Clear related fields when switching types
    if (implType === 'none') {
      setLocalCode('');
      setCodeEditorOpen(false);
      onChange(id, { implementationType: implType, code: '', stateMachineId: '', quantumCircuitId: '' });
    } else if (implType === 'code') {
      onChange(id, { implementationType: implType, stateMachineId: '', quantumCircuitId: '' });
      if (!localCode) {
        const methodName = parseMethod(value).name || 'method_name';
        const cleanMethodName = methodName.split('(')[0].trim() || 'new_method';
        const template = `def ${cleanMethodName}(self):\n    """Add your docstring here."""\n    # Add your implementation here\n    pass\n`;
        setLocalCode(template);
        onChange(id, { code: template, implementationType: implType });
      }
      setCodeEditorOpen(true);
    } else if (implType === 'state_machine') {
      setLocalCode('');
      setCodeEditorOpen(false);
      onChange(id, { implementationType: implType, code: '', quantumCircuitId: '' });
    } else if (implType === 'quantum_circuit') {
      setLocalCode('');
      setCodeEditorOpen(false);
      onChange(id, { implementationType: implType, code: '', stateMachineId: '' });
    }
  };

  const handleStateMachineChange = (smId: unknown) => {
    onChange(id, { stateMachineId: smId as string });
  };

  const handleQuantumCircuitChange = (qcId: unknown) => {
    onChange(id, { quantumCircuitId: qcId as string });
  };

  const visibilityValue = VISIBILITY_OPTIONS.find(v => v.symbol === visibility)?.value || 'public';
  const hasCode = localCode && localCode.trim().length > 0;
  const currentImplOption = IMPLEMENTATION_TYPE_OPTIONS.find(opt => opt.value === localImplType);

  // Determine display mode based on implementation type
  const showCodeEditor = localImplType === 'code';
  const showStateMachineSelector = localImplType === 'state_machine';
  const showQuantumCircuitSelector = localImplType === 'quantum_circuit';
  const showSignatureFields = localImplType === 'none' || (!hasCode && localImplType === 'code');

  return (
    <MethodRow>
      <ControlsRow>
        {/* Show visibility and name fields for signature-based methods */}
        {showSignatureFields && (
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
        
        {/* Show method name label when in code mode with code */}
        {hasCode && localImplType === 'code' && (
          <MethodNameLabel title="Method defined in Python code">
            📝 {name.split('(')[0] || 'method'}
          </MethodNameLabel>
        )}

        {/* Show method name label for state machine reference */}
        {showStateMachineSelector && (
          <MethodNameLabel title="Method behavior defined by state machine">
            🔄 {name.split('(')[0] || 'method'}
          </MethodNameLabel>
        )}

        {/* Show method name label for quantum circuit reference */}
        {showQuantumCircuitSelector && (
          <MethodNameLabel title="Method behavior defined by quantum circuit">
            ⚛️ {name.split('(')[0] || 'method'}
          </MethodNameLabel>
        )}

        <ColorButton onClick={toggleColor} />
        <Button color="link" tabIndex={-1} onClick={handleDelete}>
          <TrashIcon />
        </Button>
      </ControlsRow>

      {/* Implementation Type Selection Row */}
      <ImplementationRow>
        <ImplementationLabel>Implementation:</ImplementationLabel>
        <ImplementationTypeDropdown 
          value={localImplType} 
          onChange={handleImplementationTypeChange}
        >
          {IMPLEMENTATION_TYPE_OPTIONS.map(opt => (
            <Dropdown.Item key={opt.value} value={opt.value}>
              {opt.icon} {opt.label}
            </Dropdown.Item>
          ))}
        </ImplementationTypeDropdown>

        {/* State Machine Selector */}
        {showStateMachineSelector && (
          <>
            {availableStateMachines.length > 0 ? (
              <DiagramDropdown 
                value={stateMachineId} 
                onChange={handleStateMachineChange}
              >
                {[
                  <Dropdown.Item key="__placeholder__" value="">-- Select State Machine --</Dropdown.Item>,
                  ...availableStateMachines.map(sm => (
                    <Dropdown.Item key={sm.id} value={sm.id}>
                      {sm.name}
                    </Dropdown.Item>
                  ))
                ]}
              </DiagramDropdown>
            ) : (
              <DiagramRefLabel title="Create a State Machine diagram in your project first">
                No state machines available
              </DiagramRefLabel>
            )}
          </>
        )}

        {/* Quantum Circuit Selector */}
        {showQuantumCircuitSelector && (
          <>
            {availableQuantumCircuits.length > 0 ? (
              <DiagramDropdown 
                value={quantumCircuitId} 
                onChange={handleQuantumCircuitChange}
              >
                {[
                  <Dropdown.Item key="__placeholder__" value="">-- Select Quantum Circuit --</Dropdown.Item>,
                  ...availableQuantumCircuits.map(qc => (
                    <Dropdown.Item key={qc.id} value={qc.id}>
                      {qc.name}
                    </Dropdown.Item>
                  ))
                ]}
              </DiagramDropdown>
            ) : (
              <DiagramRefLabel title="Create a Quantum Circuit diagram in your project first">
                No quantum circuits available
              </DiagramRefLabel>
            )}
          </>
        )}

        {/* Code toggle button when in code mode */}
        {showCodeEditor && (
          <CodeButton 
            color={hasCode ? "primary" : "link"} 
            onClick={toggleCodeEditor}
            title={codeEditorOpen ? "Hide code editor" : "Show code editor"}
          >
            {codeEditorOpen ? '▼ Code' : '▶ Code'}
          </CodeButton>
        )}
      </ImplementationRow>
      
      {/* Code Editor Panel */}
      {codeEditorOpen && showCodeEditor && (
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
