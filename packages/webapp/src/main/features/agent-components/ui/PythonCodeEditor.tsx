import React, { useEffect, useRef } from 'react';
// @ts-ignore
import CodeMirrorLib from 'codemirror';
import 'codemirror/lib/codemirror.css';
// @ts-ignore
import 'codemirror/mode/python/python';

/** A small CodeMirror editor in Python mode (used for tool code). */
export function PythonCodeEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cmRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!containerRef.current || cmRef.current) return;
    const cm = (CodeMirrorLib as any)(containerRef.current, {
      value,
      mode: 'python',
      lineNumbers: true,
      lineWrapping: false,
      tabSize: 4,
      indentWithTabs: true,
      theme: 'default',
    });
    cm.on('change', (instance: any) => { onChangeRef.current(instance.getValue()); });
    cmRef.current = cm;
    return () => {
      if (cmRef.current) { cmRef.current.getWrapperElement().remove(); cmRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cmRef.current && cmRef.current.getValue() !== value) cmRef.current.setValue(value);
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-md border border-input [&_.CodeMirror]:min-h-[140px] [&_.CodeMirror]:text-sm [&_.CodeMirror]:font-mono"
    />
  );
}
