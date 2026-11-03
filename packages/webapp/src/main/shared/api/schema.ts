import type { components } from './generated/besser-openapi';

type Schemas = components['schemas'];

type AsSent<T> = T extends readonly (infer U)[]
  ? AsSent<U>[]
  : T extends object
    ? { [K in keyof T]-?: AsSent<T[K]> }
    : T;

/**
 * A response body exactly as the backend sends it: the generated schema type
 * with every field present. FastAPI serialises every field of a response model
 * (BESSER sets no `exclude_none` / `exclude_unset`), but the schema marks a
 * field with a `None` or `default_factory` default optional. A field that may
 * be absent in the schema arrives as its default (`null`, `[]`, `{}`).
 */
export type ApiResponse<Name extends keyof Schemas> = AsSent<Schemas[Name]>;
