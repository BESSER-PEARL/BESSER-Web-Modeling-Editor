/**
 * Smart Generator backend configuration — re-export of the shared module.
 *
 * The implementation moved to `shared/services/specDrivenConfig` so the
 * unified key dialog (`shared/components/byok/LlmKeyDialog`) can read the
 * free-tier advertisement without importing from a feature (feature
 * isolation: shared/ must not depend on features/). This file keeps the
 * feature-local path stable for spec-driven imports and test mocks.
 */

export * from '../../../shared/services/specDrivenConfig';
