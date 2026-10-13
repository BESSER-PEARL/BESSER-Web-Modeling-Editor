# Personalization Field Mapping for User Model Elements

The PersonalizationEditor separates **AGENT** and **GUI** rules. Existing agent
rules retain their top-level `presentation`, `modality`, and `content` storage
paths for compatibility with saved profiles. GUI rules are stored independently
under `gui.content` for semantic adaptation and
under `gui.presentation` and cover `language`, `languageComplexity`, `sentenceLength` plus text styling:
`size`, `font`, `lineSpacing`, `alignment`, `color`, and `contrast`. These GUI fields are always
available. In the GUI editor's **Create page variant** panel, select a user profile
and enable **Apply defined GUI personalization rules** to apply these fields.
This can be used alone or with **Auto-personalize with AI**. When combined, the
explicit GUI rules are applied after the LLM result, so they take priority.
Rule-based variants start from the Base page and preserve its structure and
bindings. Their snapshots are used by the existing profile-version generation.

GUI **Content → Adapt content to this user profile** enables a generic semantic
adaptation pass. The backend supplies the full selected profile and the page's
text grouped by component to an LLM, which reviews each component and changes
only content relevant to explicit profile needs. Unrelated content is kept.
For example, it can emphasize an elevator already mentioned on the page for a
user with mobility limitations, including when that information is in another
component. The prompt prohibits inventing facilities, facts, or actions.
Only modeled text slots are replaced; structure, styling, bindings, and stored
data are preserved. Content runs before language, simplicity, and sentence length,
so those explicit presentation choices also apply to the adapted content.
Enable **Apply defined GUI personalization rules** in the page variant panel;
this checkbox works independently of **Auto-personalize with AI** and Agent rules.

GUI **Content → Summarize long content** adds a short, easy-to-understand summary
above prose blocks of at least 150 whitespace-separated words. Summaries use two
or three short sentences, up to 80 words, with a heading in the source language.
The full text and its markup remain available below the summary. This rule can
be used alone. When combined with other rules, summaries are generated from the
final personalized text, before visual styling. Short controls, forms, tables,
dynamic templates, code, and stored data are excluded. Existing generated
summaries are recognized to avoid duplicates. The backend creates the summary
components; the LLM returns only heading and text strings.

GUI **Modality → Read text aloud** marks the profile's text blocks for listening.
Applying defined GUI rules shows inline **Play/Pause** and **Stop** controls below
enabled text blocks and summaries. Clicking Play generates and plays that block's preview.
These DOM controls do not become saved model components. Defined GUI rules are
selected by default when available; the designer can uncheck them.
The canvas playback controls are shown only for an
active personalized variant where Read aloud was applied; Base and other
variants hide them. Preview uses inline Play/Pause and Stop buttons, visible
generation progress, and actionable error messages.
Audio preview is explicit: use **Play** below the corresponding text block
after applying personalization with Read text aloud enabled.
The backend selects a `Text2Speech` adapter using
`BESSER_GUI_TTS_PROVIDER` (`openai` or `piper`) and `BESSER_GUI_TTS_MODEL`.
OpenAI defaults to `gpt-4o-mini-tts`. Each block/summary has a separate clip.
Preview speech is generated on demand, returned directly, and held in editor
memory while the current page and variant are active. Switching pages, variants,
modeling perspectives, or browser tabs, closing the editor, or editing the text
releases playback and discards the affected previews. It does not modify the model or store files in
the backend. When Read text aloud is enabled, React export synthesizes the final
text into the generated app's `public/audio` directory, with Play/Pause/Stop
controls and an AI-generated-voice disclosure. There is no automatic playback.
Dynamic data, forms and controls are excluded.
Full launcher instructions live in BESSER's `besser/generators/gui/tts/README.md`.

GUI **Language** offers the same choices as Agent: Original, English, Spanish,
French, German, Portuguese, Luxembourgish, and Italian. Original keeps the current
language. A selected language translates visible text and labels through the
backend, independently of general AI adaptation. When combined with Simple text,
translation runs first and simplification keeps the selected language.
GUI **Sentence length** offers the agent's Original, concise, and verbose choices.
It uses the same backend LLM helper, after translation and simplification, and
can also be applied alone. Original skips the sentence-length rewrite.

GUI **Text complexity → Simple text** optimizes modeled wording for the simplest
clear language that retains its meaning, using A1–A2 vocabulary as a target.
The GUI prompt follows W3C cognitive accessibility guidance on everyday words,
short sentences, clear actions, and consistent labels. It asks for further
simplification even when wording already meets A1–A2, while preserving facts,
conditions, and exceptions. This is a rewriting objective, not a WCAG assessment.
Enable **Apply defined GUI
personalization rules** when creating a page variant; the general AI option can
remain unchecked. The backend module `besser/generators/gui/gui_personalization.py`
extracts visible text and labels, rewrites them in a batch, and reinserts them
without changing CSS, component structure, IDs, bindings, or stored data values.
Original makes no text rewrite. If general AI is enabled as well, simplification
is applied to its result before the deterministic styling rules.

Font size is a minimum expressed in pixels: smaller text is enlarged, while
larger existing text keeps its size. This applies to table text as well.
Line spacing is a unitless line-height.
Both Agent and GUI editors offer font-size presets Medium (18px), Large (24px),
and Extra large (32px), and line-spacing presets Normal (1.2), Comfortable (1.5),
and Spacious (1.8). Original keeps the current setting; Custom accepts a numeric
value. Presets are saved as numbers, so existing custom values remain compatible.
Contrast uses a foreground/background palette; an explicit text color overrides
the palette's foreground. High contrast chooses a black or white background for
an explicit hex color. Only configured fields are applied.

This document lists the **recommended agent** personalization fields for each canvas element type in the User Profile diagram. The PersonalizationEditor shows only the recommended subset by default; users can expand to all options via the _Show all options_ toggle in the AGENT section.

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
