// Backward-compat shim.
//
// The legacy ``useDeployToGitHub`` hook used to live here and raw-fetched
// ``/github/deploy-webapp`` without the V2 ``projectExport`` envelope. It has
// been removed in favor of ``useRenderDeploy`` (which delegates to
// ``useGitHubRepo.createRepo`` and ships the envelope + agent-personalization
// payload).
//
// ``DeployResultDialog`` still imports the response TYPE from this module, so
// we keep ``DeployToGitHubResult`` as an alias of ``DeployToRenderResult``.
// Other consumers should import from ``useGitHubRepo`` / ``useRenderDeploy``
// directly.

import type { DeployToRenderResult } from '../../deploy/hooks/useRenderDeploy';

export type DeployToGitHubResult = DeployToRenderResult;
