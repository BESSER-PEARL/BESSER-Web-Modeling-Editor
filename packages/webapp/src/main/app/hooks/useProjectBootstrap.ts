import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  localStorageLatestProject,
  sessionStorageContinueFromGithubIntent,
  sessionStorageOpenAssistantOnLoad,
} from '../../shared/constants/constant';
import { useGitHubBumlImport } from '../../features/import/useGitHubBumlImport';
import { notifyError } from '../../shared/utils/notifyError';
import type { BesserProject } from '../../shared/types/project';

const KNOWN_ROUTES = [
  '/',
  '/project-settings',
  '/agent-config',
  '/agent-personalization',
  '/agent-personalization-2',
];

interface UseProjectBootstrapOptions {
  currentProject: BesserProject | null | undefined;
  loadProject: (projectId: string) => Promise<void>;
  pathname: string;
}

interface UseProjectBootstrapResult {
  showProjectHub: boolean;
  setShowProjectHub: Dispatch<SetStateAction<boolean>>;
}

export const useProjectBootstrap = ({
  currentProject,
  loadProject,
  pathname,
}: UseProjectBootstrapOptions): UseProjectBootstrapResult => {
  const [showProjectHub, setShowProjectHub] = useState(false);
  const [hasCheckedForProject, setHasCheckedForProject] = useState(false);
  const bootstrapStartedRef = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { importFromGitHub, isLoading: isGitHubImportLoading } = useGitHubBumlImport();
  const hasTokenInUrl = !KNOWN_ROUTES.includes(pathname);

  // Captured once at mount: was the user mid-"Continue from GitHub" when they
  // were bounced through the GitHub OAuth redirect? If so, keep the Project Hub
  // OPEN on return (even when a latest project loads) so the hub can jump the
  // user straight to the repo picker. The ProjectHubDialog consumes-and-clears
  // the flag; this ref keeps the intent for the lifetime of this load only.
  const continueFromGithubReopenRef = useRef<boolean>(
    (() => {
      try {
        return sessionStorage.getItem(sessionStorageContinueFromGithubIntent) !== null;
      } catch {
        return false;
      }
    })(),
  );

  useEffect(() => {
    const checkForLatestProject = async () => {
      if (hasCheckedForProject) {
        return;
      }
      if (bootstrapStartedRef.current) {
        return;
      }
      bootstrapStartedRef.current = true;

      if (hasTokenInUrl) {
        setShowProjectHub(false);
        setHasCheckedForProject(true);
        return;
      }

      const latestProjectId = localStorage.getItem(localStorageLatestProject);

      if (latestProjectId) {
        try {
          await loadProject(latestProjectId);
          setShowProjectHub(false);
        } catch {
          setShowProjectHub(true);
        }
      } else {
        setShowProjectHub(true);
      }

      // Returning from the GitHub OAuth redirect mid-"Continue from GitHub":
      // force the hub open (overriding the latest-project close above) so the
      // hub can resume on the repo picker.
      if (continueFromGithubReopenRef.current) {
        setShowProjectHub(true);
      }

      setHasCheckedForProject(true);
    };

    checkForLatestProject().catch(notifyError('Loading latest project'));
  }, [loadProject, hasCheckedForProject, hasTokenInUrl]);

  // ?agentic / ?mode=agent → the user should land in the editor with the
  // assistant drawer open. Flag it once at mount; WorkspaceShell consumes it
  // when a project is present. New agentic projects created through the hub set
  // the same flag from ProjectHubDialog; this covers the existing-project case
  // where no creation flow runs. Read once — not reactively.
  const agenticUrlRef = useRef<boolean>(
    (() => {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.has('agentic')) {
          const v = params.get('agentic');
          if (v === null || v === '' || v === 'true' || v === '1') {
            return true;
          }
        }
        return params.get('mode') === 'agent';
      } catch {
        return false;
      }
    })(),
  );
  useEffect(() => {
    if (!agenticUrlRef.current) {
      return;
    }
    try {
      sessionStorage.setItem(sessionStorageOpenAssistantOnLoad, '1');
    } catch {
      /* storage unavailable — the drawer just won't auto-open, non-fatal */
    }
  }, []);

  // Read ?buml= once on mount — not reactively — to avoid re-triggers
  const bumlUrlRef = useRef(new URLSearchParams(window.location.search).get('buml'));
  const bumlImportStartedRef = useRef(false);

  useEffect(() => {
    const bumlUrl = bumlUrlRef.current;
    if (!bumlUrl || bumlImportStartedRef.current) {
      return;
    }
    bumlImportStartedRef.current = true;
    bumlUrlRef.current = null;

    // Remove ?buml= from URL immediately to prevent any re-triggers
    const url = new URL(window.location.href);
    url.searchParams.delete('buml');
    window.history.replaceState({}, '', url.toString());

    importFromGitHub(bumlUrl).catch(notifyError('Importing B-UML project'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track whether a project was previously loaded so we only react to the
  // null ↔ non-null transition. Otherwise every Redux update of currentProject
  // (e.g. autosave from the quantum editor) would force the hub open/closed.
  const hadProjectRef = useRef<boolean>(Boolean(currentProject));

  useEffect(() => {
    if (!hasCheckedForProject) {
      return;
    }

    if (hasTokenInUrl) {
      setShowProjectHub(false);
      hadProjectRef.current = Boolean(currentProject);
      return;
    }

    const hasProject = Boolean(currentProject);
    if (hasProject !== hadProjectRef.current) {
      // Don't let the latest-project load slam the hub shut when the user is
      // returning to finish a "Continue from GitHub" — the hub owns its own
      // close (the repo picker's Continue / Cancel).
      if (!continueFromGithubReopenRef.current) {
        setShowProjectHub(!hasProject);
      }
      hadProjectRef.current = hasProject;
    }
  }, [currentProject, hasCheckedForProject, hasTokenInUrl]);

  return {
    showProjectHub,
    setShowProjectHub,
  };
};
