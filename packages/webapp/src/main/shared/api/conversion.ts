/**
 * Conversions between the editor's JSON models and other formats (BESSER
 * `routers/conversion_router.py`; `/get-json-model-from-kg` is in
 * `routers/kg_router.py`). A failure rejects with an `ApiError`.
 */
import { apiClient } from './api-client';
import type { DiagramInput } from './generation';

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
export const getJsonModel = <T = any>(bumlFile: File) =>
  apiClient.upload<T>('/get-json-model', formData([['buml_file', bumlFile]]), { timeout: CONVERSION_TIMEOUT_MS });

/** `POST /get-project-json-model`: a B-UML project file to a project JSON model. */
export const getProjectJsonModel = <T = any>(bumlFile: File) =>
  apiClient.upload<T>('/get-project-json-model', formData([['buml_file', bumlFile]]), {
    timeout: CONVERSION_TIMEOUT_MS,
  });

/** `POST /csv-to-domain-model`: spreadsheets to a class diagram. */
export const csvToDomainModel = <T = any>(files: File[]) =>
  apiClient.upload<T>('/csv-to-domain-model', formData(files.map((file): [string, File] => ['files', file])), {
    timeout: CONVERSION_TIMEOUT_MS,
  });

/**
 * `POST /get-json-model-from-image`: a picture of a diagram to a class diagram.
 * `existingModel` (the active class diagram) is merged with the picture instead of replaced.
 */
export const getJsonModelFromImage = <T = any>(
  imageFile: File,
  apiKey: string,
  existingModel?: { title: string; model: unknown },
) =>
  apiClient.upload<T>(
    '/get-json-model-from-image',
    formData([
      ['image_file', imageFile],
      ['api_key', apiKey],
      ...(existingModel ? [['existing_model', JSON.stringify(existingModel)] as [string, string]] : []),
    ]),
    { timeout: LLM_CONVERSION_TIMEOUT_MS },
  );

/** `POST /get-json-model-from-kg`: a knowledge-graph file to a diagram. */
export const getJsonModelFromKg = <T = any>(kgFile: File, apiKey: string) =>
  apiClient.upload<T>(
    '/get-json-model-from-kg',
    formData([
      ['kg_file', kgFile],
      ['api_key', apiKey],
    ]),
    { timeout: LLM_CONVERSION_TIMEOUT_MS },
  );
