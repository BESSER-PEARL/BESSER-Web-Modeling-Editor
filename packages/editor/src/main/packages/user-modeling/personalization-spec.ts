/**
 * Per-element personalization spec attached to User Profile elements.
 *
 * A "user profile model" (a `UserDiagram`) can now carry personalization change
 * specifications directly on its elements — at the profile level (the root
 * `User` box / `UMLUserModelName`) and at the attribute level (each criterion
 * row / `UMLUserModelAttribute`). This replaces the separate agent-config
 * personalization tab: the specs live on the model, so a profile carries all of
 * its own configuration plus that of its connected elements.
 *
 * The shape is a curated 3-dimension set (presentation / modality / content).
 * Every field is optional so an element only stores the dimensions the modeller
 * actually set. Field names are kept flat here (not reusing the webapp's
 * `InterfaceStyleSetting` etc.) so the editor package stays free of webapp
 * types; the webapp aggregation maps these onto `AgentConfigurationPayload`.
 */

export interface UserPresentationSpec {
  size?: number;
  font?: 'sans' | 'serif' | 'monospace' | 'neutral' | 'grotesque' | 'condensed';
  lineSpacing?: number;
  alignment?: 'left' | 'center' | 'justify';
  color?: string;
  contrast?: 'low' | 'medium' | 'high';
}

export interface UserModalitySpec {
  inputModalities?: string[];
  outputModalities?: string[];
  voiceGender?: 'male' | 'female' | 'ambiguous';
  voiceSpeed?: number;
}

export interface UserContentSpec {
  language?:
    | 'original'
    | 'english'
    | 'spanish'
    | 'french'
    | 'german'
    | 'portuguese'
    | 'luxembourgish'
    | 'italian';
  style?: 'original' | 'formal' | 'informal';
  languageComplexity?: 'original' | 'simple' | 'medium' | 'complex';
  sentenceLength?: 'original' | 'concise' | 'verbose';
  useAbbreviations?: boolean;
}

export interface UserPersonalizationSpec {
  presentation?: UserPresentationSpec;
  modality?: UserModalitySpec;
  content?: UserContentSpec;
}

/** Runtime guard used by element serialize/deserialize and the aggregation. */
export const isUserPersonalizationSpec = (value: unknown): value is UserPersonalizationSpec =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** True when a spec actually carries at least one set field (ignores empty objects). */
export const isPersonalizationSpecEmpty = (spec?: UserPersonalizationSpec | null): boolean => {
  if (!spec) return true;
  const dims = [spec.presentation, spec.modality, spec.content];
  return dims.every((dim) => !dim || Object.values(dim).every((v) => v === undefined || v === '' || v === null));
};
