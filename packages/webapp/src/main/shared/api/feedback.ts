/** User feedback (BESSER `routers/deployment_router.py`, `POST /feedback`). */
import { BACKEND_URL } from '../constants/constant';
import type { components } from './generated/besser-openapi';

export type FeedbackSubmission = components['schemas']['FeedbackSubmission'];

/** Send the feedback form; the raw `Response`, whose error body carries a `detail`. */
export const submitFeedback = (submission: FeedbackSubmission): Promise<Response> =>
  fetch(`${BACKEND_URL}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(submission),
  });
