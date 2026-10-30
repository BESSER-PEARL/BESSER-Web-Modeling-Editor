import React, { useMemo } from 'react';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';

/**
 * A YAML CodeMirror 6 editor (the same `@uiw/react-codemirror` setup as AgentConfigYamlEditor).
 * Pass `onChange` for an editable editor; omit it for a read-only view.
 */
export function YamlCodeEditor({
  value,
  onChange,
  minHeightClass = '[&_.cm-editor]:min-h-[200px]',
  className = '',
}: {
  value: string;
  onChange?: (value: string) => void;
  minHeightClass?: string;
  className?: string;
}) {
  const extensions = useMemo(() => [yaml(), EditorView.lineWrapping], []);
  const readOnly = !onChange;
  return (
    <div className={`overflow-hidden rounded-md border border-input font-mono text-sm ${minHeightClass} ${className}`}>
      <CodeMirror
        value={value}
        extensions={extensions}
        onChange={onChange}
        editable={!readOnly}
        readOnly={readOnly}
        basicSetup={{ lineNumbers: true, tabSize: 2 }}
      />
    </div>
  );
}
