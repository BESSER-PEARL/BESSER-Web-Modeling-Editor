# Study cleanup and develop integration

This branch incorporates `develop` at `1f383506`. This record describes the branch's study-specific removals and the integration adjustments.

## Removed

- Study website deployment server, deployment hook and dialogs, configuration, Docker Compose deployment, study-site setup, and deployment instructions.
- Automatic study project bootstrap, participant identifiers, welcome/consent dialog, model upload, questionnaire links, sidebar controls, and study deployment menu action.
- Study-only templates and the standalone museum example GUI were removed. The combined museum agent, GUI, and class-diagram project was restored as the general-purpose ?Museum Agent and GUI? template, with study-specific text removed.
- Participant-linked PostHog provider, study-mode recording options, model-edit middleware, personalization and read-aloud event captures, and related analytics and consent tests and documentation. Develop's consent-controlled product analytics remain.
- Study-specific translations, environment variables and Vite substitutions. Normal backend and PostHog build-time configuration follows develop.

## Adapted for develop

- Reconnected agent, GUI and user-profile personalization controls to the updated toolbar and dialogs without study event captures.
- Retained the newer generation, validation, export, security, consent, and traceability paths while applying user-profile reshaping where the backend needs it. Agent generation prioritizes the branch's profile-authored personalization whenever user profile models are available; the legacy mapping path remains for cases without profile models.
- Kept develop's runtime configuration and agent state editor, adapting the former to remove the duplicate Personalization tab. Profile-specific rules are authored through user-profile modeling; existing saved variants are retained. The branch's separate YAML-panel rewrite and agent-state editor rewrite were not carried over.
- Combined GUI presentation, content and read-aloud controls with develop's editor and API wrapper; sanitized dynamic SVG icons using develop's sanitizer.
- Merged translation keys and filled missing translations with English fallback text. Those fallback strings still need translation review.
- Removed references to the obsolete onboarding module and checklist, which were not present in develop's tracked files.

Develop already contains a separate opt-in research telemetry feature and an older study instruction PDF. Those pre-existing develop assets remain; they are unrelated to the study deployment and participant-tracking additions removed from this branch.

- Updated the recommendation dialog to use development's authenticated API client and request a GitHub sign-in when no session is available.

- The follow-up review gives the feature branch's profile-authored generation priority over legacy mappings, deduplicates saved/project copies by ID, restores development's unrelated agent runtime defaults, and aligns API calls and error reporting with development lint rules.

- Profile JSON generation preserves all original per-element personalization rules before profile boxes are merged, so the backend can include them in each generated document.

- Simplified the Generate Agent dialog: removed separate translation settings and the duplicate configuration link, and show a default-configuration notice only when the active agent has no saved runtime or YAML settings.
