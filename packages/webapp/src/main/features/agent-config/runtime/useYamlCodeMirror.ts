import { useEffect, useRef } from 'react';
// @ts-ignore
import CodeMirrorLib from 'codemirror';
import 'codemirror/lib/codemirror.css';
// @ts-ignore
import 'codemirror/mode/yaml/yaml';

/**
 * Mount a YAML CodeMirror instance in the returned container ref for the lifetime of the
 * calling component, keeping it in sync with `value`. Pass `onChange` for an editable
 * editor; omit it for a read-only view.
 */
export function useYamlCodeMirror(value: string, onChange?: (value: string) => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!containerRef.current || instanceRef.current) return;
    const readOnly = !onChangeRef.current;
    const cm = (CodeMirrorLib as any)(containerRef.current, {
      value,
      mode: 'yaml',
      lineNumbers: true,
      lineWrapping: true,
      tabSize: 2,
      ...(readOnly ? { readOnly: true } : {}),
    });
    if (!readOnly) {
      cm.on('change', (instance: any) => { onChangeRef.current?.(instance.getValue()); });
    }
    instanceRef.current = cm;
    return () => {
      if (instanceRef.current) {
        instanceRef.current.getWrapperElement().remove();
        instanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (instanceRef.current && instanceRef.current.getValue() !== value) {
      instanceRef.current.setValue(value);
    }
  }, [value]);

  return containerRef;
}
