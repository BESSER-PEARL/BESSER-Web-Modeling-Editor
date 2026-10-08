import { createElement, useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../app/store/hooks';
import { selectActiveDiagram } from '../../../app/store/workspaceSlice';
import { isUMLModel, type ProjectDiagram } from '../../../shared/types/project';
import { useGenerateCode } from './useGenerateCode';

const GOVERNANCE_DSL_ERROR = /^Invalid Governance DSL on merging gateway '([^']+)'(?=:|$)/;
const DEPLOYMENT_DIAGRAM_REQUIRED = /DeploymentDiagram is required for the Docker Compose generator/i;

/** True when some element of the diagram carries an Agent diagram link. */
function hasLinkedAgent(diagram: ProjectDiagram | null | undefined): boolean {
  if (!diagram || !isUMLModel(diagram.model)) return false;
  return Object.values(diagram.model.elements).some(
    (el) => 'agentModelRef' in el && typeof el.agentModelRef === 'string' && el.agentModelRef.length > 0,
  );
}

/**
 * Docker Compose generation for the project's Deployment diagram. Runs through
 * the shared project generation path; only the backend errors specific to
 * this generator get their own messages.
 */
export function useGenerateDockerCompose(): { generate: () => Promise<void>; isLoading: boolean } {
  const { t } = useTranslation();
  const generateCode = useGenerateCode();
  const activeDiagram = useAppSelector(selectActiveDiagram);
  const [isLoading, setIsLoading] = useState(false);

  const describeError = useCallback(
    (status: number, detail: string): ReactNode | null => {
      const governance = status === 422 ? detail.match(GOVERNANCE_DSL_ERROR) : null;
      if (governance) {
        console.error('Invalid Governance DSL:', detail);
        return createElement(
          'div',
          undefined,
          createElement('strong', undefined, t('generation.dockerCompose.invalidGovernanceTitle')),
          createElement('div', undefined, t('generation.dockerCompose.invalidGovernance', { gateway: governance[1] })),
        );
      }
      if (DEPLOYMENT_DIAGRAM_REQUIRED.test(detail)) {
        return t('generation.dockerCompose.deploymentDiagramRequired');
      }
      return null;
    },
    [t],
  );

  const generate = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await generateCode(null, 'docker_compose', activeDiagram?.title ?? '', {}, undefined, undefined, {
        describeError,
      });
      if (result.ok && !hasLinkedAgent(activeDiagram)) {
        toast.warning(t('generation.dockerCompose.noLinkedAgents'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeDiagram, describeError, generateCode, t]);

  return { generate, isLoading };
}
