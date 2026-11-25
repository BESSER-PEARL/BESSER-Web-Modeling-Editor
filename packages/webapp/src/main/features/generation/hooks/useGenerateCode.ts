import { useCallback } from 'react';
import { ApollonEditor, UMLModel } from '@besser/wme';
import { useFileDownload } from '../../../shared/services/file-download/useFileDownload';
import { toast } from 'react-toastify';
import { reportError } from '../../../shared/services/errors/reportError';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { validateDiagram } from '../../../shared/services/validation/validateDiagram';
import { confirmValidationWarnings } from '../../../shared/services/validation/confirmValidationWarnings';
import { generateFromDiagram, generateFromProject, type DiagramInput } from '../../../shared/api/generation';
import { ApiError } from '../../../shared/api/api-client';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { normalizeProjectName } from '../../../shared/utils/projectName';
import { promptForGitHubStarOnce } from '../../../shared/services/githubStarPrompt';
import { buildProjectPayloadForBackend, prepareAgentModelForBackend } from '../../../shared/utils/projectExportUtils';
import { flattenUserDiagramForBackend } from '../../../shared/utils/user-profile-graph';
import {
  restoreBaseAgentModels,
  stripAgentConfigToSystem,
} from '../../deploy';
import type { GenerationOptions, GenerationResult } from '../types';
import { getActiveDiagram } from '../../../shared/types/project';
import type { BesserProject } from '../../../shared/types/project';
import {
  generateFromProjectWithTrace,
  generateWithTrace,
  tracedFileBlob,
  type TracedGenerationResponse,
} from '../../../shared/api/traceability';
import {
  isTraceabilityEnabled,
  recordGenerationTrace,
  traceActorName,
} from '../../../shared/traceability/traceStore';
import { toastTraced, type TraceabilityTarget } from '../../traceability';
import { offerGeneratedCodeOnGitHub } from '../../github';
import type { AgentConfigurationPayload } from '../../../shared/types/agent-config';

// Add type definitions
export interface DjangoConfig {
  project_name: string;
  app_name: string;
  containerization: boolean;
}

/**
 * Spring Boot parent-POM versions offered in the Spring config dialog.
 *
 * Kept to the currently maintained 3.x lines — the generated `pom.xml` pins
 * this straight into `spring-boot-starter-parent`, so every entry has to be a
 * version that actually resolves from Maven Central. Refresh when a line goes
 * end-of-life.
 */
export const SPRING_BOOT_VERSIONS = ['3.5.6', '3.4.4', '3.3.13'] as const;
export type SpringBootVersion = (typeof SPRING_BOOT_VERSIONS)[number];
/** Mirrors `DEFAULT_SPRING_BOOT_VERSION` in the backend's Spring generator. */
export const DEFAULT_SPRING_BOOT_VERSION: SpringBootVersion = '3.4.4';

/** Java releases the generated POM can target (Spring Boot 3.x needs 17+). */
export const SPRING_JAVA_VERSIONS = ['17', '21', '25'] as const;
export type SpringJavaVersion = (typeof SPRING_JAVA_VERSIONS)[number];
/** Mirrors `DEFAULT_JAVA_VERSION` in the backend's Spring generator. */
export const DEFAULT_SPRING_JAVA_VERSION: SpringJavaVersion = '21';

/** Base Java package used when the user does not pick one. */
export const DEFAULT_SPRING_PACKAGE_NAME = 'com.example';

/**
 * Spring Boot backend generator options.
 *
 * `app_name` becomes the generated Java application class
 * (`<AppName>.java` / `<AppName>Tests.java`) and `package_name` becomes the
 * source directory path, so both must be valid Java identifiers — see the
 * inline validation in the Spring config dialog.
 */
export interface SpringConfig {
  /** Name of the generated project folder / zip. */
  project_name: string;
  /** Java application class name (also the Maven artifactId). */
  app_name: string;
  /** Spring Boot parent POM version. */
  spring_boot_version: SpringBootVersion;
  /** Java release the POM targets. */
  java_version: SpringJavaVersion;
  /** Base Java package, e.g. 'com.example'. */
  package_name: string;
}

export interface SQLConfig {
  dialect: 'sqlite' | 'postgresql' | 'mysql' | 'mssql' | 'mariadb' | 'oracle';
}

export interface SQLAlchemyConfig {
  dbms: 'sqlite' | 'postgresql' | 'mysql' | 'mssql' | 'mariadb' | 'oracle';
}

export interface SupabaseConfig {
  /** Class name that maps to auth.users. Empty string skips auth integration. */
  user_root: string;
}

export interface JSONSchemaConfig {
  mode: 'regular' | 'smart_data';
}

export interface QiskitConfig {
  backend: 'aer_simulator' | 'fake_backend' | 'ibm_quantum';
  shots: number;
}

/** Settings of the time-series forecaster (the backend's ForecastConfig, plus channel_last). */
export interface ForecasterConfig {
  /** Past values the network reads. */
  window: number;
  /** Future values it returns: the size of the network's last layer. */
  horizon: number;
  /** Period of the series: 12 for monthly data, 4 for quarterly, 7 for daily. */
  season: number;
  /** Lag of the difference: 0 (levels), 1 (first difference), or null for the season (seasonal difference). */
  difference: 0 | 1 | null;
  /** Forecast the logarithm when every value is positive. */
  log: boolean;
  /** Add the sine and cosine of the position in the season as inputs. */
  calendar: boolean;
  /** Centre and scale the differenced series on the training data. */
  standardize: boolean;
  seed: number;
  channel_last: boolean;
}

/** The backend's ForecastConfig defaults (DEFAULT_WINDOW, DEFAULT_HORIZON, DEFAULT_SEASON in forecaster_generator.py). */
export const DEFAULT_FORECASTER_CONFIG: ForecasterConfig = {
  window: 24,
  horizon: 12,
  season: 12,
  difference: null,
  log: true,
  calendar: true,
  standardize: true,
  seed: 0,
  channel_last: false,
};

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
  spring: SpringConfig;
  sql: SQLConfig;
  supabase: SupabaseConfig;
  sqlalchemy: SQLAlchemyConfig;
  jsonschema: JSONSchemaConfig;
  qiskit: QiskitConfig;
  forecaster: ForecasterConfig;
  agent: AgentConfig;
  [key: string]: any;
};

/** Statuses whose server `detail` explains a generation failure to the user. */
const DETAIL_STATUSES = new Set([400, 422, 500]);

/** Toast a failed generation request and turn it into the hook's result. */
function reportGenerationFailure(error: unknown, t: TFunction, opts?: GenerationOptions): GenerationResult {
  if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    reportError(t('generation.toasts.requestTimedOut'), { error });
    return { ok: false, error: 'Request timed out', cause: error };
  }
  if (error instanceof ApiError) {
    console.error('Response not OK:', error.status, error.message);
    if (error.detail && DETAIL_STATUSES.has(error.status)) {
      reportError(opts?.describeError?.(error.status, error.detail) ?? error.detail);
      return { ok: false, error: error.detail, cause: error };
    }
  }
  let errorMessage = t('generation.toasts.unknownError');
  if (error instanceof ApiError) {
    errorMessage = `HTTP error! status: ${error.status}`;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }
  reportError(`${errorMessage}`, { error });
  return { ok: false, error: errorMessage, cause: error };
}

/** The file name a generation response's `Content-Disposition` gives, else a default. */
function fileNameOf(headers: Headers): string {
  const contentDisposition = headers.get('Content-Disposition');
  if (contentDisposition) {
    for (const pattern of [/filename="([^"]+)"/, /filename=([^;\s]+)/, /filename="?([^";\s]+)"?/]) {
      const match = contentDisposition.match(pattern);
      if (match) return match[1];
    }
  }
  return 'generated_code.txt';
}

/** Statuses that say the backend has no traced endpoint (an older BESSER): 404, 405, 501. */
const NO_TRACED_ENDPOINT_STATUSES = new Set([404, 405, 501]);

/**
 * A refusal only the traced endpoint makes: a diagram without the id the trace refers to it by (BESSER's
 * `traced_generation.py`: "A traced generation needs the diagram id..." / "...the id of every diagram it reads"),
 * or a request field only it has (`actorName`).
 */
const TRACE_ONLY_REFUSAL = /\btraced generation\b[^]*\bid\b|\bactorName\b/i;

/**
 * Whether a failed traced request is worth repeating on the plain endpoint: only when the traced endpoint itself is
 * the problem, never when the generation failed (it would fail again, and a failing web app can take minutes):
 * the backend has no traced endpoint ({@link NO_TRACED_ENDPOINT_STATUSES}), or refused what only a traced request
 * carries ({@link TRACE_ONLY_REFUSAL}, a 400 or 422). A 500 is not retried: the backend answers a failure building
 * the trace with the same generic 500 as a generator crash, so the two cannot be told apart.
 */
function isTraceFallbackError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (NO_TRACED_ENDPOINT_STATUSES.has(error.status)) return true;
  return (error.status === 400 || error.status === 422) && TRACE_ONLY_REFUSAL.test(`${error.detail ?? ''}\n${error.message}`);
}

/**
 * Run a generation and deliver its file: through the traced endpoint when `traced` is given (the project records
 * traces), recording the run's trace fragment, else through the plain one. A traced request that fails in a way
 * the plain endpoint may not ({@link isTraceFallbackError}) is repeated on the plain endpoint, so the user still
 * gets the file, and is told the trace of this run was not recorded.
 *
 * The file is delivered before its trace is recorded, and recording never throws: a trace that cannot be
 * recorded (the user is warned) never costs the user a generation that succeeded.
 */
async function runGenerationRequest(
  project: BesserProject | null,
  traced: (() => Promise<TracedGenerationResponse>) | null,
  plain: () => Promise<{ blob: Blob; headers: Headers }>,
  deliver: (blob: Blob, filename: string) => GenerationResult,
  announce: (traced: boolean) => void,
  t: TFunction,
  opts?: GenerationOptions,
): Promise<GenerationResult> {
  let traceLost = false;
  if (traced && project) {
    let received: { response: TracedGenerationResponse; blob: Blob } | null = null;
    try {
      const response = await traced();
      received = { response, blob: tracedFileBlob(response) };
    } catch (error) {
      if (!isTraceFallbackError(error)) return reportGenerationFailure(error, t, opts);
      console.warn('The traced generation failed; generating without a trace.', error);
      traceLost = true;
    }
    if (received) {
      const result = deliver(received.blob, received.response.fileName);
      announce(recordGenerationTrace(project.id, { ...received.response.trace, projectId: project.id }));
      return result;
    }
  }
  try {
    const { blob, headers } = await plain();
    if (traceLost) toast.warn(t('generation.toasts.traceNotRecorded'));
    const result = deliver(blob, fileNameOf(headers));
    announce(false);
    return result;
  } catch (error) {
    return reportGenerationFailure(error, t, opts);
  }
}

/** The success toast of a generation: with a link to the run's lineage when its trace was recorded. */
function announceGenerated(t: TFunction, traced: TraceabilityTarget | null): void {
  const message = t('generation.toasts.codeGenerationCompleted');
  if (traced) toastTraced(message, traced);
  else toast.success(message);
}

export const useGenerateCode = () => {
  const downloadFile = useFileDownload();
  const { t } = useTranslation();

  const generateCodeFromProject = useCallback(
    async (
      generatorType: string,
      config?: GeneratorConfig[keyof GeneratorConfig],
      opts?: GenerationOptions,
    ): Promise<GenerationResult> => {
      console.log('Starting code generation from project...');

      // Read from storage at generation time as a safety net: although useStorageSync
      // keeps Redux in sync, this ensures we always pick up the very latest editor
      // saves even if a React render cycle hasn't flushed yet.
      const currentProject = ProjectStorageRepository.getCurrentProject();

      if (!currentProject) {
        reportError(t('generation.toasts.noProjectAvailable'));
        return { ok: false, error: 'No project available for code generation', reason: 'no_project' };
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
          ...(flatProject.settings as Record<string, unknown> ?? {}),
          generator: generatorType,
          config: config
        }
      };

      // Generating multiple web-app versions produces N complete apps, so scale
      // the timeout with the version count (bounded at 10 min).
      const webAppVersionCount = Array.isArray((config as any)?.webAppVersions)
        ? (config as any).webAppVersions.length
        : 0;
      const requestTimeoutMs =
        webAppVersionCount > 1 ? Math.min(600000, 300000 * webAppVersionCount) : 300000;
      // A project that records traces gets the run's trace along with the file (same bytes, same download).
      const traced = isTraceabilityEnabled(currentProject)
        ? () => generateFromProjectWithTrace(projectWithSettings, traceActorName(currentProject), requestTimeoutMs)
        : null;
      return runGenerationRequest(
        currentProject,
        traced,
        () => generateFromProject(projectWithSettings, requestTimeoutMs),
        (blob, filename) => {
          // Deferred download (assistant flow): return the blob so the caller
          // can render a result card with a manual Download button instead of
          // auto-saving. The menu path leaves autoDownload at its default (true).
          if (opts?.autoDownload === false) return { ok: true, filename, blob };
          downloadFile({ file: blob, filename });
          offerGeneratedCodeOnGitHub(blob, filename);
          return { ok: true, filename };
        },
        (traced) => {
          if (opts?.autoDownload !== false) announceGenerated(t, traced ? { tab: 'lineage' } : null);
        },
        t,
        opts,
      );
    },
    [downloadFile, t],
  );

  const runGeneration = useCallback(
    async (
      editor: ApollonEditor | null,
      generatorType: string,
      diagramTitle: string,
      config?: GeneratorConfig[keyof GeneratorConfig],
      referenceDiagramData?: Record<string, any>,
      modelOverride?: UMLModel,
      opts?: GenerationOptions,
    ): Promise<GenerationResult> => {
      console.log('Starting code generation...');

      // For Web App generator, send the entire project (doesn't need editor)
      if (generatorType === 'web_app') {
        return await generateCodeFromProject(generatorType, config, opts);
      }

      // For Qiskit generator, it uses project data not editor
      if (generatorType === 'qiskit') {
        return await generateCodeFromProject(generatorType, config, opts);
      }

      // For NN generators, use project data (like Qiskit)
      if (generatorType === 'pytorch' || generatorType === 'tensorflow' || generatorType === 'forecaster') {
        return await generateCodeFromProject(generatorType, config, opts);
      }

      // Docker Compose reads the project's Deployment diagram and the Agent
      // diagrams its artifacts reference
      if (generatorType === 'docker_compose') {
        return await generateCodeFromProject(generatorType, config, opts);
      }

      // For other generators we need a model — the live editor's, or an
      // explicit override (the assistant drawer generates from the STORED
      // class diagram regardless of which tab is visually active).
      const modelForGeneration = modelOverride ?? editor?.model;
      if (!modelForGeneration) {
        console.error('No editor or model available');
        reportError(t('generation.toasts.noDiagram'));
        return { ok: false, error: 'No diagram to generate code from', reason: 'invalid_input' };
      }

      // Validate before generation when a live editor is present (the
      // pre-existing behavior — including the agent-personalization case
      // that passes BOTH an editor and an override). An override without an
      // editor comes from stored project data; the backend still validates
      // structurally during generation. The model actually being sent is
      // what gets validated.
      if (editor) {
        const validationResult = await validateDiagram(null, diagramTitle, modelForGeneration);
        if (!validationResult.isValid) {
          reportError(validationResult.message || t('generation.toasts.validationFailed'));
          return {
            ok: false,
            error: validationResult.message || 'Validation failed',
            // `failure` is set when the validation request itself failed, not the model:
            // no reason then, which is how a failed request is reported.
            ...(validationResult.failure === undefined
              ? { reason: 'validation' as const }
              : { cause: validationResult.failure }),
          };
        }
        if (!(await confirmValidationWarnings(validationResult.warnings))) {
          return { ok: false, error: 'Generation cancelled to fix the validation warnings', reason: 'warnings_declined' };
        }
      }

      // Prepare body for single diagram generation. modelOverride is used by
      // agent personalization to ship the un-personalized base instead of
      // whatever variant happens to be active in the editor — see
      // handleAgentGenerate in useGeneratorExecution.
      const body: DiagramInput = {
        title: diagramTitle,
        model: generatorType === 'agent' ? prepareAgentModelForBackend(modelForGeneration) : flattenUserDiagramForBackend(modelForGeneration),
        generator: generatorType,
        config: config,
        ...(referenceDiagramData ? { referenceDiagramData } : {}),
      };

      // For agent generation, include the user-authored config.yaml from the diagram
      if (generatorType === 'agent') {
        const currentProject = ProjectStorageRepository.getCurrentProject();
        const activeAgentDiagram = currentProject
          ? currentProject.diagrams.AgentDiagram?.[
              currentProject.currentDiagramIndices?.AgentDiagram ?? 0
            ]
          : undefined;
        if (typeof activeAgentDiagram?.configYaml === 'string') {
          body.configYaml = activeAgentDiagram.configYaml;
        }
      }

      // A project that records traces gets the run's trace along with the file, from the traced endpoint (same
      // file, same download), whatever the generator. The trace refers to the model by its diagram's id: the one
      // the caller names (a model read from storage), else the open diagram's.
      const project = ProjectStorageRepository.getCurrentProject();
      const diagramId = opts?.traceDiagramId ?? (project ? getActiveDiagram(project, project.currentDiagramType)?.id : undefined);
      const traced = project && diagramId && isTraceabilityEnabled(project)
        ? () => generateWithTrace({ ...body, id: diagramId, actorName: traceActorName(project) })
        : null;
      return runGenerationRequest(
        project,
        traced,
        () => generateFromDiagram(body, 300000),
        (blob, filename) => {
          if (opts?.autoDownload === false) return { ok: true, filename, blob };
          downloadFile({ file: blob, filename });
          offerGeneratedCodeOnGitHub(blob, filename);
          return { ok: true, filename };
        },
        (traced) => {
          if (opts?.autoDownload !== false) announceGenerated(t, traced ? { tab: 'lineage', root: diagramId } : null);
        },
        t,
        opts,
      );
    },
    [downloadFile, generateCodeFromProject, t],
  );

  // A first successful generation is when the user has just gotten value
  // from BESSER, so that is when we ask (once per browser) for a GitHub star.
  const generateCode = useCallback(
    async (...args: Parameters<typeof runGeneration>): Promise<GenerationResult> => {
      const result = await runGeneration(...args);
      if (result.ok) promptForGitHubStarOnce();
      return result;
    },
    [runGeneration],
  );

  return generateCode;
};
