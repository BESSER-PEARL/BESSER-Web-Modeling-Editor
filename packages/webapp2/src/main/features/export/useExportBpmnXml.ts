import { useCallback } from 'react';
import { ApollonEditor, UMLDiagramType } from '@besser/wme';
import { useFileDownload } from '../../shared/services/file-download/useFileDownload';
import { apollonBpmnToXml } from './bpmn-xml-exporter';

export const useExportBpmnXml = () => {
  const downloadFile = useFileDownload();

  const exportBpmnXml = useCallback(
    (editor: ApollonEditor, diagramTitle: string) => {
      const model = editor.model;
      if (!model || model.type !== UMLDiagramType.BPMN) {
        throw new Error('BPMN 2.0 XML export requires a BPMN diagram.');
      }

      const { xml, skipped } = apollonBpmnToXml(model);

      if (skipped.length > 0) {
        // eslint-disable-next-line no-console
        console.warn(
          `[BPMN XML export] Skipped ${skipped.length} element(s) not mapped to BPMN 2.0:`,
          skipped,
        );
      }

      const safeTitle = (diagramTitle || 'Diagram').trim() || 'Diagram';
      const fileName = `${safeTitle}.bpmn`;
      const file = new File([xml], fileName, { type: 'application/bpmn+xml' });
      downloadFile({ file, filename: fileName });
    },
    [downloadFile],
  );

  return exportBpmnXml;
};