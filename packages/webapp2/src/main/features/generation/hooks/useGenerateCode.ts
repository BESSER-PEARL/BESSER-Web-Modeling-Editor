import { useCallback } from 'react';
import { ApollonEditor } from '@besser/wme';
import { useFileDownload } from '../../../shared/services/file-download/useFileDownload';
import { toast } from 'react-toastify';
import { validateDiagram } from '../../../shared/services/validation/validateDiagram';
import { BACKEND_URL } from '../../../shared/constants/constant';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { normalizeProjectName } from '../../../shared/utils/projectName';
import { buildProjectPayloadForBackend } from '../../../shared/utils/projectExportUtils';
import {
  restoreBaseAgentModels,
  stripAgentConfigToSystem,
} from '../../deploy/utils/restoreBaseAgentModels';
import type { GenerationResult } from '../types';
import type { AgentConfigurationPayload } from '../../../shared/types/agent-config';

// Add type definitions
export interface DjangoConfig {
  project_name: string;
  app_name: string;
  containerization: boolean;
}

export interface SQLConfig {
  dialect: 'sqlite' | 'postgresql' | 'mysql' | 'mssql' | 'mariadb' | 'oracle';
}

export interface SQLAlchemyConfig {
  dbms: 'sqlite' | 'postgresql' | 'mysql' | 'mssql' | 'mariadb' | 'oracle';
}

export interface JSONSchemaConfig {
  mode: 'regular' | 'smart_data';
}

export interface QiskitConfig {
  backend: 'aer_simulator' | 'fake_backend' | 'ibm_quantum';
  shots: number;
}

export interface AgentConfig {
  languages?: {
    source: string;
    target: string[];
  };
  baseModel?: Record<string, any>;
  variations?: Array<{
    name: string;
    model: Record<string, any>;
    config: AgentConfigurationPayload | Record<string, any>;
  }>;
  personalizationMapping?: Array<{
    name: string;
    configuration: AgentConfigurationPayload | Record<string, any>;
    user_profile: Record<string, any>;
    agent_model: Record<string, any>;
  }>;
  [key: string]: any;
}

export type GeneratorConfig = {
  django: DjangoConfig;
  sql: SQLConfig;
  sqlalchemy: SQLAlchemyConfig;
  jsonschema: JSONSchemaConfig;
  qiskit: QiskitConfig;
  agent: AgentConfig;
  [key: string]: any;
};

export const useGenerateCode = () => {
  const downloadFile = useFileDownload();

  const generateCodeFromProject = useCallback(
    async (generatorType: string, config?: GeneratorConfig[keyof GeneratorConfig]): Promise<GenerationResult> => {
      console.log('Starting code generation from project...');

      // Read from storage at generation time as a safety net: although useStorageSync
      // keeps Redux in sync, this ensures we always pick up the very latest editor
      // saves even if a React render cycle hasn't flushed yet.
      const currentProject = ProjectStorageRepository.getCurrentProject();

      if (!currentProject) {
        toast.error('No project available for code generation');
        return { ok: false, error: 'No project available for code generation' };
      }

      // Web app generation embeds agents using each AgentDiagram's own
      // `.model` + `.config`. If the user ran Save & Apply in the Agent
      // Configuration panel, both got replaced with the personalized variant
      // and its full config — which would make the backend trigger the
      // personalization codegen path. Swap back to the base model + a
      // system-only config so this matches "None" in the standalone agent
      // generator.
      const projectForBackend = generatorType === 'web_app'
        ? stripAgentConfigToSystem(restoreBaseAgentModels(currentProject))
        : currentProject;

      // Send full project with diagram arrays — backend uses currentDiagramIndices
      const flatProject = buildProjectPayloadForBackend(projectForBackend);

      // Add generator and config to project settings
      const projectWithSettings = {
        ...flatProject,
        name: normalizeProjectName(currentProject.name || 'project'),
        settings: {
          ...flatProject.settings,
          generator: generatorType,
          config: config
        }
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);
      try {
        const response = await fetch(`${BACKEND_URL}/generate-output-from-project`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
          },
          body: JSON.stringify(projectWithSettings),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(e => ({ detail: 'Could not parse error response' }));
          console.error('Response not OK:', response.status, errorData);

          if (response.status === 400 && errorData.detail) {
            toast.error(`${errorData.detail}`);
            return { ok: false, error: `${errorData.detail}` };
          }

          if (response.status === 500 && errorData.detail) {
            toast.error(`${errorData.detail}`);
            return { ok: false, error: `${errorData.detail}` };
          }

          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const blob = await response.blob();

        // Get the filename from the response headers
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'generated_code.txt'; // Default filename

        if (contentDisposition) {
          const patterns = [
            /filename="([^"]+)"/,
            /filename=([^;\s]+)/,
            /filename="?([^";\s]+)"?/
          ];

          for (const pattern of patterns) {
            const match = contentDisposition.match(pattern);
            if (match) {
              filename = match[1];
              break;
            }
          }
        }

        downloadFile({ file: blob, filename });
        toast.success('Code generation completed successfully');
        return { ok: true, filename };
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          toast.error('Request timed out. Please try again.');
          return { ok: false, error: 'Request timed out' };
        }
        let errorMessage = 'Unknown error occurred';
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        toast.error(`${errorMessage}`);
        return { ok: false, error: errorMessage };
      } finally {
        clearTimeout(timeoutId);
      }
    },
    [downloadFile],
  );

  const generateCode = useCallback(
    async (
      editor: ApollonEditor | null,
      generatorType: string,
      diagramTitle: string,
      config?: GeneratorConfig[keyof GeneratorConfig],
      referenceDiagramData?: Record<string, any>,
    ): Promise<GenerationResult> => {
      console.log('Starting code generation...');

      // For Web App generator, send the entire project (doesn't need editor)
      if (generatorType === 'web_app') {
        return await generateCodeFromProject(generatorType, config);
      }

      // For Qiskit generator, it uses project data not editor
      if (generatorType === 'qiskit') {
        return await generateCodeFromProject(generatorType, config);
      }

      // For other generators, we need the editor and model
      if (!editor || !editor.model) {
        console.error('No editor or model available');
        toast.error('No diagram to generate code from');
        return { ok: false, error: 'No diagram to generate code from' };
      }

      // Validate diagram before generation
      const validationResult = await validateDiagram(editor, diagramTitle);
      if (!validationResult.isValid) {
        toast.error(validationResult.message || 'Validation failed');
        return { ok: false, error: validationResult.message || 'Validation failed' };
      }

      // Prepare body for single diagram generation
      const body: any = {
        title: diagramTitle,
        model: editor.model,
        generator: generatorType,
        config: config,
        ...(referenceDiagramData ? { referenceDiagramData } : {}),
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);
      try {
        const response = await fetch(`${BACKEND_URL}/generate-output`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(e => ({ detail: 'Could not parse error response' }));
          console.error('Response not OK:', response.status, errorData); // Debug log

          if (response.status === 400 && errorData.detail) {
            toast.error(`${errorData.detail}`);
            return { ok: false, error: `${errorData.detail}` };
          }

          if (response.status === 500 && errorData.detail) {
            toast.error(`${errorData.detail}`);
            return { ok: false, error: `${errorData.detail}` };
          }

          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const blob = await response.blob();

        // Get the filename from the response headers
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'generated_code.txt'; // Default filename

        if (contentDisposition) {
          // Try multiple patterns to extract filename
          const patterns = [
            /filename="([^"]+)"/,
            /filename=([^;\s]+)/,
            /filename="?([^";\s]+)"?/
          ];

          for (const pattern of patterns) {
            const match = contentDisposition.match(pattern);
            if (match) {
              filename = match[1];
              break;
            }
          }
        }

        downloadFile({ file: blob, filename });
        toast.success('Code generation completed successfully');
        return { ok: true, filename };
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          toast.error('Request timed out. Please try again.');
          return { ok: false, error: 'Request timed out' };
        }

        let errorMessage = 'Unknown error occurred';
        if (error instanceof Error) {
          errorMessage = error.message;
        }

        toast.error(`${errorMessage}`);
        return { ok: false, error: errorMessage };
      } finally {
        clearTimeout(timeoutId);
      }
    },
    [downloadFile, generateCodeFromProject],
  );

  return generateCode;
};
