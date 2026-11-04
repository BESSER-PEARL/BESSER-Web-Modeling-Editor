import { describe, expectTypeOf, it } from 'vitest';

import type { components } from '../generated/besser-openapi';

type Schemas = components['schemas'];

// The backend's response models state every field they send as required
// (BESSER `models/responses.py`, `ResponseModel`), and closed value sets as
// literals, so the generated types need no editor-side narrowing.
describe('generated response types', () => {
  it('mark fields the backend always sends as required, keeping null where it sends null', () => {
    expectTypeOf<Schemas['GitHubCommitResponse']['origin']>().toEqualTypeOf<string | null>();
    expectTypeOf<Schemas['KGPreflightReportResponse']['issues']>().toEqualTypeOf<Schemas['KGIssueResponse'][]>();
    expectTypeOf<Schemas['SyncStatusResponse']['pending']>().toEqualTypeOf<Schemas['PendingChangeStatus'] | null>();
    expectTypeOf<Schemas['RepoSummaryResponse']['diagram_counts']>().toEqualTypeOf<{ [key: string]: number }>();
  });

  it('type closed value sets and fixed shapes exactly', () => {
    expectTypeOf<Schemas['SaveProjectResponse']['status']>().toEqualTypeOf<'pushed' | 'merged' | 'conflict'>();
    expectTypeOf<Schemas['PushSmartToGitHubResponse']['status']>().toEqualTypeOf<
      'pushed' | 'merged' | 'conflict' | 'pull_request'
    >();
    expectTypeOf<Schemas['PendingChangeStatus']['pull_request_state']>().toEqualTypeOf<
      'open' | 'closed' | 'merged' | null
    >();
    expectTypeOf<Schemas['KGConsistencyIssueResponse']['severity']>().toEqualTypeOf<'info' | 'warning' | 'violation'>();
    expectTypeOf<Schemas['KGConsistencyReportResponse']['inferenceUsed']>().toEqualTypeOf<'rdfs' | 'owlrl'>();
    expectTypeOf<Schemas['KGConsistencyReportResponse']['severityCounts']>().toEqualTypeOf<{
      info: number;
      warning: number;
      violation: number;
    }>();
    expectTypeOf<Schemas['ImportGitHubRunResponse']['analysis']>().toEqualTypeOf<Schemas['CodeAnalysisResponse'] | null>();
    expectTypeOf<Schemas['DeployToGitHubResponse']['deployment_type']>().toEqualTypeOf<'webapp' | 'chatbot'>();
    // A first deploy has no live links yet: the backend omits them.
    expectTypeOf<Schemas['DeployToGitHubResponse']['deployment_urls']>().toEqualTypeOf<{
      github: string;
      render: string;
      live_frontend?: string;
      live_backend?: string;
      live_chatbot?: string;
      render_dashboard?: string;
    }>();
  });
});
