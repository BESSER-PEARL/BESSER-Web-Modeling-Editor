import { describe, expectTypeOf, it } from 'vitest';

import type { ApiResponse } from '../schema';

describe('ApiResponse', () => {
  it('makes every schema field present, keeping null where the backend sends it', () => {
    type Commit = ApiResponse<'GitHubCommitResponse'>;
    expectTypeOf<Commit['origin']>().toEqualTypeOf<string | null>();
    expectTypeOf<ApiResponse<'KGPreflightReportResponse'>['issues']>().toEqualTypeOf<
      ApiResponse<'KGIssueResponse'>[]
    >();
    // Nested schemas get the same treatment.
    expectTypeOf<ApiResponse<'SyncStatusResponse'>['commits_since'][number]>().toEqualTypeOf<Commit>();
    expectTypeOf<ApiResponse<'RepoSummaryResponse'>['diagram_counts']>().toEqualTypeOf<{ [key: string]: number }>();
  });
});
