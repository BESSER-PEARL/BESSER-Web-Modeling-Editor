import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { localStorageLatestProject } from '../../shared/constants/constant';
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

      setHasCheckedForProject(true);
    };

    checkForLatestProject().catch(notifyError('Loading latest project'));
  }, [loadProject, hasCheckedForProject, hasTokenInUrl]);

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
      setShowProjectHub(!hasProject);
      hadProjectRef.current = hasProject;
    }
  }, [currentProject, hasCheckedForProject, hasTokenInUrl]);

  return {
    showProjectHub,
    setShowProjectHub,
  };
};
