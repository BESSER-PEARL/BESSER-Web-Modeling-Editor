/**
 * Where the Project Hub resumes after the GitHub OAuth redirect.
 *
 * Stored under `sessionStorageContinueFromGithubIntent`, the key the bootstrap
 * (useProjectBootstrap) already reads to keep the hub open on return. `'1'`,
 * written by "Continue from GitHub", resumes on the repo picker; a JSON value
 * resumes on the landing or on the create form with what the user had typed.
 */
import { sessionStorageContinueFromGithubIntent } from '../../shared/constants/constant';
import type { InterfaceMode } from '../../shared/types/project';

export interface CreateFormResume {
  step: 'create';
  /** The hub step the form was reached from; drives Back and the step badge. */
  entryStep: 'welcome' | 'start';
  form: { name: string; description: string; owner: string };
  mode: InterfaceMode | null;
  perspectiveKey: string;
}

export type HubGithubResume = { step: 'github' } | { step: 'welcome' } | CreateFormResume;

const CONTINUE_FROM_GITHUB = '1';

const isString = (value: unknown): value is string => typeof value === 'string';

const parse = (raw: string): HubGithubResume | null => {
  if (raw === CONTINUE_FROM_GITHUB) return { step: 'github' };
  try {
    const value = JSON.parse(raw);
    if (value?.step === 'welcome') return { step: 'welcome' };
    if (
      value?.step === 'create'
      && (value.entryStep === 'welcome' || value.entryStep === 'start')
      && isString(value.form?.name) && isString(value.form?.description) && isString(value.form?.owner)
      && (value.mode === 'model' || value.mode === 'agent' || value.mode === null)
      && isString(value.perspectiveKey)
    ) {
      return {
        step: 'create',
        entryStep: value.entryStep,
        form: { name: value.form.name, description: value.form.description, owner: value.form.owner },
        mode: value.mode,
        perspectiveKey: value.perspectiveKey,
      };
    }
  } catch {
    /* not ours */
  }
  return null;
};

export const peekHubGithubResume = (): HubGithubResume | null => {
  try {
    const raw = sessionStorage.getItem(sessionStorageContinueFromGithubIntent);
    return raw === null ? null : parse(raw);
  } catch {
    return null;
  }
};

export const stashHubGithubResume = (resume: Exclude<HubGithubResume, { step: 'github' }>): void => {
  try {
    sessionStorage.setItem(sessionStorageContinueFromGithubIntent, JSON.stringify(resume));
  } catch {
    /* storage unavailable: sign-in still proceeds, the hub just opens at its default step */
  }
};

export const clearHubGithubResume = (): void => {
  try {
    sessionStorage.removeItem(sessionStorageContinueFromGithubIntent);
  } catch {
    /* ignore */
  }
};
