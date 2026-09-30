import React, { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';

/** A small CodeMirror 6 editor in Python mode (used for tool code). */
export function PythonCodeEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const extensions = useMemo(() => [python()], []);
  return (
    <div className="overflow-hidden rounded-md border border-input font-mono text-sm [&_.cm-editor]:min-h-[140px]">
      <CodeMirror
        value={value}
        extensions={extensions}
        onChange={onChange}
        basicSetup={{ lineNumbers: true, tabSize: 4 }}
      />
    </div>
  );
}
