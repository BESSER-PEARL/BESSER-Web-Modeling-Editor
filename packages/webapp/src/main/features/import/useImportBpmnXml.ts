import { useCallback } from 'react';
import { uuid } from '../../shared/utils/uuid';
import { ProjectDiagram } from '../../shared/types/project';
import { bpmnXmlToApollon } from './bpmn-xml-importer';

/**
 * Reads a `.bpmn` / `.xml` file, parses it to a v4 BPMN `ProjectDiagram`
 * (`model.type === 'BPMNDiagram'`), and surfaces parse warnings / skipped
 * elements to the console. Same return contract as `useBumlToDiagram` so
 * `useImportDiagram` can call it identically.
 */
export const useImportBpmnXml = () => {
  return useCallback(async (file: File): Promise<ProjectDiagram> => {
    const text = await file.text();
    const result = bpmnXmlToApollon(text);

    if (result.warnings.length) {
      console.warn(
        `[BPMN import] ${result.warnings.length} parse warning(s):`,
        result.warnings.map((w) => `${w.code}: ${w.message}`).join('\n'),
      );
    }
    if (result.skipped.length) {
      console.warn(
        `[BPMN import] Skipped ${result.skipped.length} element(s): ` +
          Array.from(new Set(result.skipped.map((s) => s.xmlTag))).join(', '),
      );
    }

    const title = file.name.replace(/\.(bpmn\.xml|bpmn|xml)$/i, '');
    return {
      id: uuid(),
      title: title || 'Imported BPMN',
      model: result.model,
      lastUpdate: new Date().toISOString(),
      description: 'Imported from BPMN 2.0 XML',
    };
  }, []);
};
