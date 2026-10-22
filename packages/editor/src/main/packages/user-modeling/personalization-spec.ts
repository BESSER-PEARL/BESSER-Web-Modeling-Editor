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
 * Agent settings use presentation / modality / content. GUI settings live
 * separately under `gui.presentation` and initially cover text styling.
 * Every field is optional so an element only stores the dimensions the modeller
 * actually set. Field names are kept flat here (not reusing the webapp's
 * `InterfaceStyleSetting` etc.) so the editor package stays free of webapp
 * types; the webapp aggregation maps these onto `AgentConfigurationPayload`.
 */

export interface UserPresentationSpec {
  size?: number;
  font?: 'sans' | 'serif' | 'monospace' | 'neutral' | 'grotesque' | 'condensed' | 'hyperlegible' | 'lexend' | 'dyslexia' | 'verdana' | 'fredoka';
  lineSpacing?: number;
  alignment?: 'left' | 'center' | 'justify';
  color?: string;
  contrast?: 'low' | 'medium' | 'high';
  language?:
    | 'original'
    | 'english'
    | 'spanish'
    | 'french'
    | 'german'
    | 'portuguese'
    | 'luxembourgish'
    | 'italian';
  /** How the agent addresses the user, independently of how it explains information. */
  conversationalTone?: 'original' | 'formal' | 'informal' | 'friendly' | 'technical';
  /** How information is presented; facts and the core message must be preserved. */
  explanationStyle?: 'original' | 'direct' | 'step-by-step' | 'narrative';
  /** @deprecated Read older saved profiles; new edits use conversationalTone. */
  style?: UserPresentationSpec['conversationalTone'];
  languageComplexity?: 'original' | 'simple' | 'medium' | 'complex';
  sentenceLength?: 'original' | 'concise' | 'verbose';
  useAbbreviations?: boolean;
}

/** Shared choices and examples for both profile editors. */
export const EXPLANATION_STYLE_OPTIONS = [
  { value: 'original', label: 'Original', example: 'Keep the existing way of explaining information.' },
  { value: 'direct', label: 'Direct', example: 'The fortress protected the city.' },
  { value: 'step-by-step', label: 'Step-by-step', example: 'First, select a ticket. Then, confirm your booking.' },
  { value: 'narrative', label: 'Narrative', example: 'Imagine approaching the city: the fortress stands before you, protecting the people inside.' },
] as const;

export const EXPLANATION_STYLE_HELP =
  'Changes how information is explained while preserving facts and the core message. Applies where useful; practical answers such as opening hours stay direct.';

export interface UserModalitySpec {
  inputModalities?: string[];
  outputModalities?: string[];
  voiceGender?: 'male' | 'female' | 'ambiguous';
  voiceSpeed?: number;
}

export interface UserContentSpec {
  /**
   * When enabled, the agent tailors the semantic substance of its responses to
   * this user profile — e.g. surfacing profile-relevant examples, omitting
   * topics that are not relevant to the user, or emphasising information that
   * matches the user's background. This is a semantic change to *what* the
   * agent says, as opposed to presentation settings which only affect *how*
   * it says it.
   */
  adaptContentToUserProfile?: boolean;
}

/** GUI presentation rules are independent of the agent's presentation. */
export type UserGuiPresentationSpec = Pick<
  UserPresentationSpec,
  'size' | 'font' | 'lineSpacing' | 'alignment' | 'color' | 'contrast' | 'language' | 'sentenceLength'
> & {
  languageComplexity?: 'original' | 'simple';
};

export interface UserGuiPersonalizationSpec {
  presentation?: UserGuiPresentationSpec;
  content?: UserContentSpec & { summarizeLongContent?: boolean };
  modality?: { readAloud?: boolean };
}

export interface UserPersonalizationSpec {
  // Existing top-level dimensions belong to the agent. Keep their storage
  // paths compatible with saved profiles and the agent generation pipeline.
  presentation?: UserPresentationSpec;
  modality?: UserModalitySpec;
  content?: UserContentSpec;
  gui?: UserGuiPersonalizationSpec;
}

/** Runtime guard used by element serialize/deserialize and the aggregation. */
export const isUserPersonalizationSpec = (value: unknown): value is UserPersonalizationSpec =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** True when a spec actually carries at least one set field (ignores empty objects). */
export const isPersonalizationSpecEmpty = (spec?: UserPersonalizationSpec | null): boolean => {
  if (!spec) return true;
  const dims = [spec.presentation, spec.modality, spec.content, spec.gui?.presentation, spec.gui?.content, spec.gui?.modality];
  return dims.every((dim) => !dim || Object.values(dim).every((v) => v === undefined || v === '' || v === null));
};
