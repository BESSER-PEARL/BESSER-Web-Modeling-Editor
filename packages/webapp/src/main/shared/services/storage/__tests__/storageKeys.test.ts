/**
 * On-disk storage key names. Users' browsers already hold data under these
 * spellings: renaming a constant must not rename the key, or that data is lost.
 */
import { describe, expect, it } from 'vitest';

import * as keys from '../../../constants/constant';

describe('storage keys', () => {
  it('keep their on-disk spellings', () => {
    expect({
      storageVersion: keys.localStorageStorageVersion,
      language: keys.localStorageLanguage,
      analyticsConsent: keys.localStorageAnalyticsConsent,
      assistantUserId: keys.localStorageAssistantUserId,
      rateLimiterState: keys.localStorageAssistantRateLimiterState,
      rateLimiterProbe: keys.localStorageAssistantRateLimiterProbe,
      gitHubUsername: keys.localStorageGitHubUsername,
      runSeedModels: keys.localStorageSpecDrivenRunSeedModels,
      legacyLinkedRepos: keys.localStorageLegacyGitHubLinkedRepos,
      legacyAutoCommit: keys.localStorageLegacyGitHubAutoCommit,
      legacyAgentConfig: keys.localStorageLegacyAgentConfig,
      latestProject: keys.localStorageLatestProject,
      preferredInterface: keys.localStoragePreferredInterface,
      starPrompted: keys.localStorageGitHubStarPrompted,
      conversation: keys.sessionStorageAssistantConversation,
      assistantSessionId: keys.sessionStorageAssistantSessionId,
      demoToken: keys.sessionStorageDemoToken,
      chunkReloaded: keys.sessionStorageChunkReloaded,
      gitHubSession: keys.sessionStorageGitHubSession,
      gitHubSessionTimestamp: keys.sessionStorageGitHubSessionTimestamp,
      gitHubSessionExpired: keys.sessionStorageGitHubSessionExpired,
      drawerOpen: keys.sessionStorageAssistantDrawerOpen,
      openAssistantOnLoad: keys.sessionStorageOpenAssistantOnLoad,
      handleHinted: keys.sessionStorageAssistantHandleHinted,
      pendingPrompt: keys.sessionStoragePendingAssistantPrompt,
      continueFromGithub: keys.sessionStorageContinueFromGithubIntent,
      pushIntent: keys.sessionStorageSpecDrivenPushIntent,
    }).toEqual({
      storageVersion: 'besser_storage_version',
      language: 'besser_language',
      analyticsConsent: 'besser_analytics_consent',
      assistantUserId: 'besser_assistant_user_id',
      rateLimiterState: 'umlAgentRateLimiterState',
      rateLimiterProbe: '__umlAgentRateLimiter__',
      gitHubUsername: 'github_username',
      runSeedModels: 'besser_smartgen_run_seed_models',
      legacyLinkedRepos: 'besser_github_linked_repos',
      legacyAutoCommit: 'besser_github_auto_commit',
      legacyAgentConfig: 'agentConfig',
      latestProject: 'besser_latest_project',
      preferredInterface: 'besser_preferred_interface',
      starPrompted: 'besser_github_star_prompted',
      conversation: 'besser_assistant_conversation_v1',
      assistantSessionId: 'besser-assistant-session-id',
      demoToken: 'besser-demo-token',
      chunkReloaded: 'besser_chunkReloaded',
      gitHubSession: 'github_session',
      gitHubSessionTimestamp: 'github_session_timestamp',
      gitHubSessionExpired: 'github_session_expired',
      drawerOpen: 'besser_assistant_drawer_open',
      openAssistantOnLoad: 'besser_open_assistant_on_load',
      handleHinted: 'besser_assistant_handle_hinted',
      pendingPrompt: 'besser_pending_assistant_prompt',
      continueFromGithub: 'besser_continue_from_github_intent',
      pushIntent: 'besser_smart_gen_push_intent',
    });
  });

  it('lists the legacy unprefixed keys the v2 migration and the reset remove', () => {
    expect(keys.legacyUnprefixedLocalStorageKeys).toEqual([
      'latestDiagram',
      'agentConfig',
      'agentPersonalization',
      'github_session',
      'github_username',
      'last_published_token',
      'last_published_type',
      'umlAgentRateLimiterState',
    ]);
  });
});
