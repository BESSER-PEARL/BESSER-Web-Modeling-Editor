export type GenerationResult =
  | {
      ok: true;
      filename?: string;
    }
  | {
      ok: false;
      error: string;
    };
