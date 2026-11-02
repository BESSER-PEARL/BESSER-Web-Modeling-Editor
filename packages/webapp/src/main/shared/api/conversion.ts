/**
 * Conversions between the editor's JSON models and other formats (BESSER
 * `routers/conversion_router.py`; `/get-json-model-from-kg` is in
 * `routers/kg_router.py`). Each call returns the raw `Response`; the caller
 * parses the model or the error `detail`. No client-side timeout.
 */
import { BACKEND_URL } from '../constants/constant';

const postJson = (path: string, body: unknown, accept?: string): Promise<Response> =>
  fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accept ? { Accept: accept } : {}),
    },
    body: JSON.stringify(body),
  });

const postForm = (path: string, fields: Array<[string, string | Blob]>): Promise<Response> => {
  const formData = new FormData();
  fields.forEach(([name, value]) => formData.append(name, value));
  return fetch(`${BACKEND_URL}${path}`, { method: 'POST', body: formData });
};

/** `POST /export-buml`: one diagram (backend `DiagramInput`) as a B-UML Python file. */
export const exportBuml = (body: unknown): Promise<Response> =>
  postJson('/export-buml', body, 'application/json, text/plain, application/zip, */*');

/** `POST /export-project-as-buml`: a project (backend `ProjectInput`) as one B-UML Python file. */
export const exportProjectAsBuml = (project: unknown): Promise<Response> =>
  postJson('/export-project-as-buml', project);

/** `POST /get-json-model`: a B-UML file to a diagram (or a project) JSON model. */
export const getJsonModel = (bumlFile: File): Promise<Response> =>
  postForm('/get-json-model', [['buml_file', bumlFile]]);

/** `POST /get-project-json-model`: a B-UML project file to a project JSON model. */
export const getProjectJsonModel = (bumlFile: File): Promise<Response> =>
  postForm('/get-project-json-model', [['buml_file', bumlFile]]);

/** `POST /csv-to-domain-model`: spreadsheets to a class diagram. */
export const csvToDomainModel = (files: File[]): Promise<Response> =>
  postForm('/csv-to-domain-model', files.map((file): [string, File] => ['files', file]));

/**
 * `POST /get-json-model-from-image`: a picture of a diagram to a class diagram.
 * `existingModel` (the active class diagram) is merged with the picture instead of replaced.
 */
export const getJsonModelFromImage = (
  imageFile: File,
  apiKey: string,
  existingModel?: { title: string; model: unknown },
): Promise<Response> =>
  postForm('/get-json-model-from-image', [
    ['image_file', imageFile],
    ['api_key', apiKey],
    ...(existingModel ? [['existing_model', JSON.stringify(existingModel)] as [string, string]] : []),
  ]);

/** `POST /get-json-model-from-kg`: a knowledge-graph file to a diagram. */
export const getJsonModelFromKg = (kgFile: File, apiKey: string): Promise<Response> =>
  postForm('/get-json-model-from-kg', [
    ['kg_file', kgFile],
    ['api_key', apiKey],
  ]);
