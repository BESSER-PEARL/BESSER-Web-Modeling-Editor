/**
 * The tab's GitHub sign-in (shared/services/github/githubAuth.ts): every
 * component using this hook sees the same session, sign-out and expiry.
 */
import { useEffect, useSyncExternalStore } from 'react';
import {
  getGitHubAuthState,
  signInWithGitHub,
  signOutOfGitHub,
  startGitHubAuth,
  subscribeGitHubAuth,
} from '../services/github/githubAuth';

export const useGitHubAuth = () => {
  const auth = useSyncExternalStore(subscribeGitHubAuth, getGitHubAuthState);
  useEffect(startGitHubAuth, []);
  const isAuthenticated = auth.status === 'signed-in';
  return {
    status: auth.status,
    isAuthenticated,
    /** A stored session is being verified: wait rather than starting a new sign-in. */
    isChecking: auth.status === 'checking',
    /** The session was rejected or aged out; offer "Reconnect" instead of "Connect". */
    isExpired: auth.status === 'expired',
    /** Signed in elsewhere, but not in this tab: a neutral "Connect", not an error. */
    isNotInTab: auth.status === 'not-in-tab',
    username: auth.username,
    githubSession: isAuthenticated ? auth.session : null,
    isLoading: auth.redirecting,
    login: signInWithGitHub,
    logout: signOutOfGitHub,
  };
};
