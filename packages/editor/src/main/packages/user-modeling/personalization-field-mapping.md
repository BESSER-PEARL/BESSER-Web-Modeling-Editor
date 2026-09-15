# Personalization Field Mapping for User Model Elements

This document lists the **recommended** personalization fields for each canvas element type in the User Profile diagram. The PersonalizationEditor shows only the recommended subset by default; users can expand to all options via the _Show all options_ toggle.

The guiding principle for this mapping is: **can the personalization be reasonably and directly inferred from this specific attribute, without making an unrelated assumption?** If not, the field is excluded from the recommended set.

---

## Personalization Dimensions

The taxonomy follows Conrardy et al. [ICWE 2026], which defines four personalization categories for conversational agents. Three are currently modelled here (Behavior is out of scope):

| Dimension | Definition | Fields |
|-----------|-----------|--------|
| **Presentation** | Adapts *how* content is delivered without changing its meaning — covers both linguistic style choices and visual/auditory form | `language`, `style`, `languageComplexity`, `sentenceLength`, `useAbbreviations`, `size`, `font`, `lineSpacing`, `alignment`, `color`, `contrast` |
| **Modality** | Adapts the input/output channels used for interaction | `inputModalities`, `outputModalities`, `voiceGender`, `voiceSpeed` |
| **Content** | Adapts *what* is shown or done — i.e. the semantics of the interaction. Currently limited to a single boolean that enables the full semantic adaptation pipeline | `adaptContentToUserProfile` |

### `content.adaptContentToUserProfile`

When enabled, the agent tailors the semantic substance of its responses to this user profile — e.g. surfacing profile-relevant examples, omitting topics not relevant to the user, or emphasising information that matches their background. This is a semantic change to *what* the agent says, as opposed to presentation fields which only affect *how* it says it. The adaptation is driven by an LLM that receives the full user profile as context at both design time (rewriting hardcoded responses) and runtime (via a context prompt).

---

## Element-to-Field Mapping

### `User` — root profile element

**Recommended: all fields**

The root `User` box is the top-level profile specification for an entire user segment. Rather than a single causal attribute, it represents the complete profile, so all personalization dimensions can meaningfully be set here as profile-wide defaults.

---

### `Language` (attributes: `iso693_3`, `level`)

**Recommended fields:**

| Field | Rationale |
|-------|-----------|
| `presentation.language` | Direct: set the output language to match the user's spoken language |
| `presentation.languageComplexity` | Match complexity to the user's CEFR proficiency level |
| `presentation.sentenceLength` | Shorter sentences for lower proficiency levels |
| `presentation.useAbbreviations` | Avoid domain abbreviations with lower-proficiency users |

**Not recommended:** `style` (register is not directly inferred from a language element), `font` (script stack is a technical detail, not a direct user preference), modality fields (I/O channel choice is independent of language), voice settings, `adaptContentToUserProfile`.

---

### `Skill` (attributes: `name`, `score`)

**Recommended fields:**

| Field | Rationale |
|-------|-----------|
| `presentation.languageComplexity` | Expert users expect technical depth; beginners need simplification |
| `presentation.useAbbreviations` | Domain abbreviations are appropriate only at higher skill levels |
| `content.adaptContentToUserProfile` | Skill domain context can inform what the agent says (e.g. tailoring examples to the skill area) |

**Not recommended:** `language` (skills are language-independent), `style` (formality is not directly skill-driven), visual presentation fields, modality fields, voice settings.

---

### `Education` (attributes: `fieldOfDegree`, `degreeType`)

**Recommended fields:**

| Field | Rationale |
|-------|-----------|
| `presentation.languageComplexity` | Academic degree implies higher reading level; no degree implies simpler language |
| `presentation.useAbbreviations` | Field-specific abbreviations suit relevant graduates |
| `content.adaptContentToUserProfile` | `fieldOfDegree` provides domain context that can meaningfully shape what the agent says |

**Not recommended:** `language` (nationality/language are separate attributes), `style` (formality is not directly education-driven), visual presentation fields, modality fields, voice settings.

---

### `Disability` (attributes: `name`, `affects`)

**Recommended fields** (which apply depends on the `affects` attribute):

| Field | Rationale |
|-------|-----------|
| `presentation.size` | Larger font for visual impairments |
| `presentation.font` | Dyslexia-friendly fonts (e.g. neutral/grotesque) for reading disorders |
| `presentation.lineSpacing` | Increased spacing aids readability for visual/cognitive disabilities |
| `presentation.alignment` | Left-aligned text is easier to scan for dyslexia |
| `presentation.color` | Color adjustments for color-blindness or visual impairments |
| `presentation.contrast` | High contrast for low vision; reduced contrast for photo-sensitivity |
| `presentation.languageComplexity` | Cognitive disabilities benefit from simpler language |
| `presentation.sentenceLength` | Short sentences reduce cognitive load |
| `presentation.useAbbreviations` | Avoid abbreviations that increase cognitive load |
| `modality.inputModalities` | Motor impairments → voice input; hearing impairments → text-only input |
| `modality.outputModalities` | Visual impairments → audio output; hearing impairments → text-only output |
| `modality.voiceSpeed` | Slower speech aids comprehension for cognitive or hearing disabilities |
| `content.adaptContentToUserProfile` | Content can be semantically filtered (e.g. no exercise recommendations involving affected body parts) |

**Not recommended:** `presentation.language` and `presentation.style` (not disability-driven), `modality.voiceGender` (not an accessibility parameter).

---

### `Culture` (attributes: `religion`)

**Recommended fields:**

| Field | Rationale |
|-------|-----------|
| `content.adaptContentToUserProfile` | Religious/cultural context can require avoiding or prioritising certain recommendations; this is a semantic content adaptation |

**Not recommended:** `presentation.language` — language should be modelled explicitly via a `Language` element, not inferred from religion. `presentation.style`, visual settings, modality, and voice settings are not directly inferred from cultural/religious identity. `languageComplexity` and `sentenceLength` are skill/education concerns.

---

### `Personal_Information` (attributes: `gender`, `age`, `nationality_iso3166`)

**Recommended fields** (driven primarily by `age` and `nationality`):

| Field | Rationale |
|-------|-----------|
| `presentation.languageComplexity` | Age-appropriate reading level (simpler for young children or elderly users) |
| `presentation.sentenceLength` | Shorter sentences are more accessible for children or elderly users |
| `presentation.size` | Larger text benefits elderly users |
| `content.adaptContentToUserProfile` | Nationality provides cultural/contextual information relevant to *what* the agent says; age informs age-appropriate content |

**Not recommended:**
- `presentation.language` — nationality is not a proxy for language; if language preference matters, model it explicitly with a `Language` element.
- `modality.voiceGender` — voice gender should not be inferred from the `gender` attribute without explicit user preference; no default personalization is applied for gender.
- `presentation.style`, deep visual settings (font, line spacing, contrast), and modality channel fields are not directly driven by personal information.

---

## Adding a New Element Type

If a new element type is added to the user model, add an entry to `personalization-field-config.ts` in the `ELEMENT_SUGGESTED_FIELDS` map. Until an entry is added, the editor falls back to showing **all** fields for that element type — nothing breaks, but the UX is unfiltered.
