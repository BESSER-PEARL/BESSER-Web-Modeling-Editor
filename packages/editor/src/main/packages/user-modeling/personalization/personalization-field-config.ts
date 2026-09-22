/**
 * Semantic mapping: user model element className → recommended personalization fields.
 *
 * For each canvas element type, only a subset of all personalization options is
 * directly driven by the data that element captures.  The PersonalizationEditor
 * uses this mapping to show only the recommended subset by default; the user
 * can expand to see every option via the "Show all options" toggle.
 *
 * Field keys use the dot-path format `<dimension>.<field>` matching
 * UserPersonalizationSpec (e.g. `content.language`, `modality.voiceGender`).
 *
 * See also: personalization-field-mapping.md (human-readable rationale).
 */

export type PersonalizationFieldKey =
  | 'presentation.size'
  | 'presentation.font'
  | 'presentation.lineSpacing'
  | 'presentation.alignment'
  | 'presentation.color'
  | 'presentation.contrast'
  | 'presentation.language'
  | 'presentation.style'
  | 'presentation.languageComplexity'
  | 'presentation.sentenceLength'
  | 'presentation.useAbbreviations'
  | 'modality.inputModalities'
  | 'modality.outputModalities'
  | 'modality.voiceGender'
  | 'modality.voiceSpeed'
  | 'content.adaptContentToUserProfile';

export const ALL_PERSONALIZATION_FIELDS: PersonalizationFieldKey[] = [
  'presentation.size',
  'presentation.font',
  'presentation.lineSpacing',
  'presentation.alignment',
  'presentation.color',
  'presentation.contrast',
  'presentation.language',
  'presentation.style',
  'presentation.languageComplexity',
  'presentation.sentenceLength',
  'presentation.useAbbreviations',
  'modality.inputModalities',
  'modality.outputModalities',
  'modality.voiceGender',
  'modality.voiceSpeed',
  'content.adaptContentToUserProfile',
];

/**
 * Recommended personalization fields per user model element className.
 *
 * Elements not listed here (unknown classNames) fall back to showing ALL fields —
 * so new element types are always fully editable before an explicit mapping is added.
 */
const ELEMENT_SUGGESTED_FIELDS: Record<string, PersonalizationFieldKey[]> = {
  /**
   * User (root profile element): the profile-level override that acts as the
   * catch-all specification for an entire user segment. All fields are relevant.
   */
  User: ALL_PERSONALIZATION_FIELDS,

  /**
   * Language (iso693_3 code, CEFR proficiency level): the user's language
   * ability most directly informs the output language, linguistic complexity
   * matching the user's proficiency, and whether voice interaction is useful.
   * Font matters for non-Latin script languages (Arabic, Chinese, etc.).
   */
  /**
   * Language (iso693_3 code, CEFR proficiency level): directly determines the
   * output language and how linguistically complex/abbreviated it should be.
   * Font, style, and modality are not direct inferences from a language element.
   */
  Language: [
    'presentation.language',
    'presentation.languageComplexity',
    'presentation.sentenceLength',
    'presentation.useAbbreviations',
  ],

  /**
   * Skill (name, score): expertise level drives technical depth and whether
   * domain abbreviations are appropriate. `fieldOfDegree`-style domain context
   * can also inform what the agent says, hence adaptContentToUserProfile.
   */
  Skill: [
    'presentation.languageComplexity',
    'presentation.useAbbreviations',
    'content.adaptContentToUserProfile',
  ],

  /**
   * Education (fieldOfDegree, degreeType): academic background influences
   * expected reading level, domain terminology, and whether content should be
   * semantically tailored to the user's field.
   */
  Education: [
    'presentation.languageComplexity',
    'presentation.useAbbreviations',
    'content.adaptContentToUserProfile',
  ],

  /**
   * Disability (name, affects): the primary driver of accessibility adaptations.
   * Which fields apply depends on the `affects` attribute (visual, motor,
   * cognitive, hearing). Language and style are not disability-driven.
   */
  Disability: [
    'presentation.size',
    'presentation.font',
    'presentation.lineSpacing',
    'presentation.alignment',
    'presentation.color',
    'presentation.contrast',
    'presentation.languageComplexity',
    'presentation.sentenceLength',
    'presentation.useAbbreviations',
    'modality.inputModalities',
    'modality.outputModalities',
    'modality.voiceSpeed',
    'content.adaptContentToUserProfile',
  ],

  /**
   * Culture (religion): the modelled religious/cultural information is most
   * useful for adapting the semantic content of agent responses — e.g. avoiding
   * or prioritising recommendations based on cultural constraints. It is not a
   * reliable proxy for language (model that explicitly), style, or presentation.
   */
  Culture: [
    'content.adaptContentToUserProfile',
  ],

  /**
   * Personal_Information (gender, age, nationality_iso3166):
   * - age: age-appropriate complexity, sentence length, and font size.
   * - nationality: semantically relevant context for content adaptation; NOT a
   *   proxy for language (use a Language element for that).
   * - gender: no default personalization — voiceGender should not be inferred
   *   from gender identity without explicit user preference.
   */
  Personal_Information: [
    'presentation.languageComplexity',
    'presentation.language',
    'presentation.sentenceLength',
    'presentation.size',
    'content.adaptContentToUserProfile',
  ],
};

/**
 * Return the recommended personalization fields for a given canvas element
 * className.  Returns `undefined` for unknown classNames so PersonalizationEditor
 * falls back to showing all fields.
 */
export function getSuggestedPersonalizationFields(
  className: string | undefined,
): PersonalizationFieldKey[] | undefined {
  if (!className) return undefined;
  return ELEMENT_SUGGESTED_FIELDS[className];
}
