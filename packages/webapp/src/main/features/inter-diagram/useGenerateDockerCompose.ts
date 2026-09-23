import { createElement, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useFileDownload } from '../../shared/services/file-download/useFileDownload';
import { BACKEND_URL } from '../../shared/constants/constant';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { normalizeProjectName } from '../../shared/utils/projectName';
import { buildProjectPayloadForBackend } from '../../shared/utils/projectExportUtils';
import { useAppSelector } from '../../app/store/hooks';

export function useGenerateDockerCompose(): { generate: () => Promise<void>; isLoading: boolean } {
  const [isLoading, setIsLoading] = useState(false);
  const downloadFile = useFileDownload();
  const activeDiagram = useAppSelector((s) => s.workspace.activeDiagram);

  const generate = useCallback(async () => {
    const currentProject = ProjectStorageRepository.getCurrentProject();
    if (!currentProject) {
      toast.error('No project available for generation');
      return;
    }

    const flatProject = buildProjectPayloadForBackend(currentProject);
    const payload = {
      ...flatProject,
      settings: {
        ...(typeof flatProject.settings === 'object' && flatProject.settings !== null
          ? flatProject.settings
          : {}),
        generator: 'docker_compose',
        config: {},
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000);
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/generate-output-from-project`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/plain, */*',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Could not parse error response' }));
        let detail: string = errorData?.detail ?? `HTTP ${response.status}`;
        const governanceDslMatch = response.status === 422 && typeof errorData?.detail === 'string'
          ? errorData.detail.match(/^Invalid Governance DSL on merging gateway '([^']+)'(?=:|$)/)
          : null;
        if (governanceDslMatch) {
          const gatewayName = governanceDslMatch[1];
          const governanceDslMessage = `Check the governance policy on gateway “${gatewayName}”. See the browser console for details.`;
          console.error('Invalid Governance DSL:', errorData.detail);
          toast.error(
            createElement(
              'div',
              undefined,
              createElement('strong', undefined, 'Invalid Governance DSL'),
              createElement('div', undefined, governanceDslMessage),
            ),
          );
          return;
        }
        if (/required for the deployment/i.test(detail)) {
          detail = 'No Deployment diagram content found — add at least one element before generating.';
        }
        toast.error(detail);
        return;
      }

      const blob = await response.blob();

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${normalizeProjectName(currentProject.name || 'project')}-docker-compose.zip`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";\s]+)"?/);
        if (match) filename = match[1];
      }

      downloadFile({ file: blob, filename });

      const elements = (activeDiagram?.model as Record<string, unknown> | undefined)?.elements ?? {};
      const hasLinkedAgent = Object.values(elements as Record<string, Record<string, unknown>>).some(
        (el) => typeof el.agentModelRef === 'string' && el.agentModelRef.length > 0,
      );
      if (hasLinkedAgent) {
        toast.success('Docker Compose files generated successfully');
      } else {
        toast.warning(
          'Docker Compose generated — no agents are linked to any artifact yet. ' +
            'Run the BPMN → Component → Deployment derivation to wire agent contexts.',
        );
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        toast.error('Request timed out. Please try again.');
      } else {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        toast.error(msg);
      }
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, [downloadFile, activeDiagram]);

  return { generate, isLoading };
}
