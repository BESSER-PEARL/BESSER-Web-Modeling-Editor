/** User feedback (BESSER `routers/deployment_router.py`, `POST /feedback`). */
import { apiClient } from './api-client';
import type { components } from './generated/besser-openapi';

export type FeedbackSubmission = components['schemas']['FeedbackSubmission'];
export type FeedbackResponse = components['schemas']['FeedbackResponse'];

/** The server may mail the feedback (its SMTP timeout is 30 s). */
const FEEDBACK_TIMEOUT_MS = 60_000;

/** Send the feedback form. A failure rejects with an `ApiError`. */
export const submitFeedback = (submission: FeedbackSubmission) =>
  apiClient.post<FeedbackResponse>('/feedback', submission, { timeout: FEEDBACK_TIMEOUT_MS });
