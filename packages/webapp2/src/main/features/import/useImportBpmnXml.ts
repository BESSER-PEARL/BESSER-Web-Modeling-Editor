import { useCallback } from 'react';
import { uuid } from '../../shared/utils/uuid';
import { ProjectDiagram } from '../../shared/types/project';
import { bpmnXmlToApollon, ImportResult } from './bpmn-xml-importer';

export const useImportBpmnXml = () => {
  return useCallback(async (file: File): Promise<ProjectDiagram> => {
    const text = await file.text();
    const result: ImportResult = bpmnXmlToApollon(text);

    if (result.warnings.length) {
      console.warn(
        `[BPMN import] ${result.warnings.length} warning(s):`,
        result.warnings.map((w) => `${w.code}: ${w.message}`).join('\n'),
      );
    }
    if (result.skipped.length) {
      console.warn(
        `[BPMN import] Skipped ${result.skipped.length} element(s): ` +
          Array.from(new Set(result.skipped.map((s) => s.xmlTag))).join(', '),
      );
    }

    const title = file.name.replace(/\.(bpmn|bpmn\.xml|xml)$/i, '');
    return {
      id: uuid(),
      title: title || 'Imported BPMN',
      model: result.model,
      lastUpdate: new Date().toISOString(),
      description: 'Imported from BPMN 2.0 XML',
    };
  }, []);
};
