/** Separate study observation from ordinary, consented feature metrics. */
export const createPostHogOptions = (studyMode: boolean, host: string | undefined) => ({
  api_host: host,
  autocapture: studyMode,
  capture_pageview: studyMode,
  capture_pageleave: studyMode,
  disable_session_recording: !studyMode,
  opt_out_capturing_by_default: true,
  opt_out_persistence_by_default: true,
  opt_out_capturing_cookie_prefix: studyMode ? 'besser_study_v2' : 'besser_normal_v2',
  respect_dnt: !studyMode,
  persistence: 'localStorage+cookie' as const,
  persistence_name: studyMode ? 'besser_study_v2' : 'besser_normal_v2',
  ip: false,
});
