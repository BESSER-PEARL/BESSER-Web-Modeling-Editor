import { useCallback } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { validateAllBpmnFlows } from '@besser/wme';
import { uuid } from '../../shared/utils/uuid';
import { ProjectDiagram } from '../../shared/types/project';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { bpmnXmlToApollon, ImportResult } from './bpmn-xml-importer';

export const useImportBpmnXml = () => {
  const { t } = useTranslation();
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
    // Flows live in model.relationships, their endpoint nodes in model.elements —
    // the validator needs both in one map to resolve a flow's source/target.
    const flowWarnings = validateAllBpmnFlows({
      ...(result.model.elements ?? {}),
      ...(result.model.relationships ?? {}),
    } as Record<string, { id: string; type: string }>);
    if (flowWarnings.length) {
      console.warn(
        `[BPMN import] ${flowWarnings.length} flow validation warning(s):`,
        flowWarnings.map((w) => `${w.code}: ${w.message}`).join('\n'),
      );
    }

    // A task or lane may link an Agent diagram that is not in this project
    // (deleted, or a file from another project). Keep the ref (the popup then
    // offers "Define" again) but warn about it.
    const refWarnings: string[] = [];
    const currentProject = ProjectStorageRepository.getCurrentProject();
    if (currentProject) {
      const liveAgentIds = new Set(currentProject.diagrams.AgentDiagram.map((d) => d.id));
      for (const el of Object.values(result.model.elements)) {
        if (
          (el.type === 'BPMNTask' || el.type === 'BPMNSwimlane') &&
          'agentDiagramRef' in el &&
          typeof el.agentDiagramRef === 'string' &&
          !liveAgentIds.has(el.agentDiagramRef)
        ) {
          refWarnings.push(
            t('import.warnings.danglingAgentRef', { name: el.name || t('import.warnings.unnamedElement') }),
          );
        }
      }
    }

    // Self-contained warn toast: summarise the actual messages (parse + flow),
    // capped so the toast stays compact. Console keeps the full detail.
    const allWarnings = [
      ...result.warnings.map((w) => w.message),
      ...flowWarnings.map((w) => w.message),
      ...refWarnings,
    ];
    if (allWarnings.length) {
      const MAX_SHOWN = 4;
      const shown = allWarnings.slice(0, MAX_SHOWN);
      const summary =
        `BPMN imported with ${allWarnings.length} validation warning(s):\n` +
        shown.map((m) => `• ${m}`).join('\n') +
        (allWarnings.length > MAX_SHOWN ? `\n• …and ${allWarnings.length - MAX_SHOWN} more` : '');
      toast.warn(summary, { style: { whiteSpace: 'pre-line' } });
    }

    const title = file.name.replace(/\.(bpmn|bpmn\.xml|xml)$/i, '');
    return {
      id: uuid(),
      title: title || 'Imported BPMN',
      model: result.model,
      lastUpdate: new Date().toISOString(),
      description: 'Imported from BPMN 2.0 XML',
    };
  }, [t]);
};
