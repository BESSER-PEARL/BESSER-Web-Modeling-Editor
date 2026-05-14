import { useCallback } from 'react';
import { toast } from 'react-toastify';
import { validateAllBpmnFlows } from '@besser/wme';
import { uuid } from '../../shared/utils/uuid';
import { ProjectDiagram } from '../../shared/types/project';
import { bpmnXmlToApollon, ImportResult } from './bpmn-xml-importer';

export const useImportBpmnXml = () => {
  return useCallback(async (file: File): Promise<ProjectDiagram> => {
    const text = await file.text();
    const result: ImportResult = bpmnXmlToApollon(text);

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

    // O3: model-level flow validation — catches illegal flow types / dangling
    // endpoints that prevention (O2) and the parser cannot stop (e.g. a
    // hand-edited .bpmn). Warn-only; the diagram still imports (04C / C-D7).
    const flowWarnings = validateAllBpmnFlows(
      (result.model.elements ?? {}) as Record<string, { id: string; type: string }>,
    );
    if (flowWarnings.length) {
      console.warn(
        `[BPMN import] ${flowWarnings.length} flow validation warning(s):`,
        flowWarnings.map((w) => `${w.code}: ${w.message}`).join('\n'),
      );
    }

    const totalWarnings = result.warnings.length + flowWarnings.length;
    if (totalWarnings) {
      toast.warn(`BPMN imported with ${totalWarnings} validation warning(s) — see console for details.`);
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
