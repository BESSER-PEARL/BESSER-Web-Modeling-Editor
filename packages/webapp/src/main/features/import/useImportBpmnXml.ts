import { useCallback } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { validateAllBpmnFlows } from '@besser/wme';
import { uuid } from '../../shared/utils/uuid';
import { ProjectDiagram } from '../../shared/types/project';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { bpmnXmlToModel, ImportResult } from './bpmn-xml-importer';

/** Max warning lines shown in the import toast — the console keeps the full detail. */
const MAX_WARNINGS_SHOWN = 4;

/**
 * Reads a `.bpmn` / `.xml` file, parses it to a v4 BPMN `ProjectDiagram`
 * (`model.type === 'BPMNDiagram'`), surfaces parse warnings / skipped
 * elements to the console, and runs model-level flow validation. Same return
 * contract as `useBumlToDiagram` so `useImportDiagram` can call it identically.
 */
export const useImportBpmnXml = () => {
  const { t } = useTranslation();

  return useCallback(
    async (file: File): Promise<ProjectDiagram> => {
      const text = await file.text();
      const result: ImportResult = bpmnXmlToModel(text);

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

      // Model-level flow validation — catches illegal flow types / dangling
      // endpoints that up-front connection rules and the parser cannot stop
      // (e.g. a hand-edited .bpmn). Warn-only; the diagram still imports.
      const flowWarnings = validateAllBpmnFlows(result.model);
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
        for (const node of result.model.nodes) {
          const ref = node.data?.agentDiagramRef;
          if (
            (node.type === 'bpmnTask' || node.type === 'bpmnSwimlane') &&
            typeof ref === 'string' &&
            !liveAgentIds.has(ref)
          ) {
            const name = typeof node.data.name === 'string' ? node.data.name : '';
            refWarnings.push(
              t('import.warnings.danglingAgentRef', { name: name || t('import.warnings.unnamedElement') }),
            );
          }
        }
      }

      // Self-contained warn toast: summarise the actual messages (parse + flow +
      // dangling refs), capped so the toast stays compact.
      const allWarnings = [
        ...result.warnings.map((w) => w.message),
        ...flowWarnings.map((w) => w.message),
        ...refWarnings,
      ];
      if (allWarnings.length) {
        const shown = allWarnings.slice(0, MAX_WARNINGS_SHOWN);
        const summary =
          t('import.bpmn.warningsSummary', { count: allWarnings.length }) +
          '\n' +
          shown.map((m) => `• ${m}`).join('\n') +
          (allWarnings.length > MAX_WARNINGS_SHOWN
            ? `\n• ${t('import.bpmn.moreWarnings', { count: allWarnings.length - MAX_WARNINGS_SHOWN })}`
            : '');
        toast.warn(summary, { style: { whiteSpace: 'pre-line' } });
      }

      const title = file.name.replace(/\.(bpmn\.xml|bpmn|xml)$/i, '');
      return {
        id: uuid(),
        title: title || t('import.bpmn.defaultTitle'),
        model: result.model,
        lastUpdate: new Date().toISOString(),
        description: t('import.descriptions.importedFromBpmnXml'),
      };
    },
    [t],
  );
};
