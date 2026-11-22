/**
 * Conversions between the editor's JSON models and other formats (BESSER
 * `routers/conversion_router.py`; `/get-json-model-from-kg` is in
 * `routers/kg_router.py`). A failure rejects with an `ApiError`.
 */
import { apiClient } from './api-client';
import type { components } from './generated/besser-openapi';
import type { DiagramInput } from './generation';

type DiagramExportResponse = components['schemas']['DiagramExportResponse'];
type ProjectExportResponse = components['schemas']['ProjectExportResponse'];
type SdmxImportRequest = components['schemas']['SdmxImportRequest'];
type SdmxProvidersResponse = components['schemas']['SdmxProvidersResponse'];

/** A model conversion runs B-UML code server side; well past the client's 30 s default. */
const CONVERSION_TIMEOUT_MS = 120_000;
/** Reading a picture or a knowledge graph is an LLM call. */
const LLM_CONVERSION_TIMEOUT_MS = 300_000;

const formData = (fields: Array<[string, string | Blob]>): FormData => {
  const form = new FormData();
  fields.forEach(([name, value]) => form.append(name, value));
  return form;
};

/** `POST /export-buml`: one diagram as a B-UML Python file (or a zip). */
export const exportBuml = (body: DiagramInput) =>
  apiClient.downloadBlob('/export-buml', body, {
    headers: { Accept: 'application/json, text/plain, application/zip, */*' },
    timeout: CONVERSION_TIMEOUT_MS,
  });

/**
 * `POST /export-project-as-buml`: a project (backend `ProjectInput`) as one
 * B-UML Python file. Typed `unknown`: the editor builds the payload as a
 * plain record (`buildProjectPayloadForBackend`).
 */
export const exportProjectAsBuml = (project: unknown) =>
  apiClient.downloadBlob('/export-project-as-buml', project, { timeout: CONVERSION_TIMEOUT_MS });

/** `POST /get-json-model`: a B-UML file to a diagram (or a project) JSON model. */
export const getJsonModel = (bumlFile: File) =>
  apiClient.upload<DiagramExportResponse>('/get-json-model', formData([['buml_file', bumlFile]]), { timeout: CONVERSION_TIMEOUT_MS });

/** `POST /get-project-json-model`: a B-UML project file to a project JSON model. */
export const getProjectJsonModel = (bumlFile: File) =>
  apiClient.upload<ProjectExportResponse>('/get-project-json-model', formData([['buml_file', bumlFile]]), {
    timeout: CONVERSION_TIMEOUT_MS,
  });

/** `POST /csv-to-domain-model`: spreadsheets to a class diagram. */
export const csvToDomainModel = (files: File[]) =>
  apiClient.upload<DiagramExportResponse>('/csv-to-domain-model', formData(files.map((file): [string, File] => ['files', file])), {
    timeout: CONVERSION_TIMEOUT_MS,
  });

/**
 * `POST /get-json-model-from-image`: a picture of a diagram to a class diagram.
 * `existingModel` (the active class diagram) is merged with the picture instead of replaced.
 */
export const getJsonModelFromImage = (
  imageFile: File,
  apiKey: string,
  existingModel?: { title: string; model: unknown },
) =>
  apiClient.upload<DiagramExportResponse>(
    '/get-json-model-from-image',
    formData([
      ['image_file', imageFile],
      ['api_key', apiKey],
      ...(existingModel ? [['existing_model', JSON.stringify(existingModel)] as [string, string]] : []),
    ]),
    { timeout: LLM_CONVERSION_TIMEOUT_MS },
  );

/** `POST /get-json-model-from-kg`: a knowledge-graph file to a diagram. */
export const getJsonModelFromKg = (kgFile: File, apiKey: string) =>
  apiClient.upload<DiagramExportResponse>(
    '/get-json-model-from-kg',
    formData([
      ['kg_file', kgFile],
      ['api_key', apiKey],
    ]),
    { timeout: LLM_CONVERSION_TIMEOUT_MS },
  );

/** `GET /sdmx-providers`: the preset SDMX providers and whether a custom API URL is accepted. */
export const getSdmxProviders = () => apiClient.get<SdmxProvidersResponse>('/sdmx-providers');

/**
 * How long the editor waits for `POST /sdmx-to-domain-model`: above the backend's own deadline for one
 * import (`BESSER_SDMX_TIMEOUT`, 60 s by default) plus the time to build and convert the model.
 */
const SDMX_IMPORT_TIMEOUT_MS = 120_000;

/** `POST /sdmx-to-domain-model`: the class diagram of an SDMX dataflow. */
export const sdmxToDomainModel = (body: SdmxImportRequest) =>
  apiClient.post<DiagramExportResponse>('/sdmx-to-domain-model', body, { timeout: SDMX_IMPORT_TIMEOUT_MS });

/** Personalization runs several sequential LLM calls over every training sentence and reply. */
const AGENT_TRANSFORM_TIMEOUT_MS = 600_000;

/** `POST /transform-agent-model-json`: an agent model personalized by its configuration. No response model in the schema. */
export const transformAgentModelJson = (body: DiagramInput) =>
  apiClient.post<unknown>('/transform-agent-model-json', body, { timeout: AGENT_TRANSFORM_TIMEOUT_MS });
