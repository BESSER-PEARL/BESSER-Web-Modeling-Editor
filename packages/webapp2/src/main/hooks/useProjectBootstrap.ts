import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { localStorageLatestProject } from '../constant';
import { useGitHubBumlImport } from '../services/import/useGitHubBumlImport';
import type { BesserProject } from '../types/project';

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

    checkForLatestProject().catch(console.error);
  }, [loadProject, hasCheckedForProject, hasTokenInUrl]);

  useEffect(() => {
    const bumlUrl = searchParams.get('buml');
    if (!bumlUrl || isGitHubImportLoading) {
      return;
    }

    let isCancelled = false;

    const importBumlProject = async () => {
      await importFromGitHub(bumlUrl);

      if (isCancelled) {
        return;
      }

      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.delete('buml');
      setSearchParams(nextSearchParams, { replace: true });
    };

    importBumlProject().catch(console.error);

    return () => {
      isCancelled = true;
    };
  }, [searchParams, setSearchParams, importFromGitHub, isGitHubImportLoading]);

  useEffect(() => {
    if (!hasCheckedForProject) {
      return;
    }

    if (hasTokenInUrl) {
      setShowProjectHub(false);
      return;
    }

    setShowProjectHub(!currentProject);
  }, [currentProject, hasCheckedForProject, hasTokenInUrl]);

  return {
    showProjectHub,
    setShowProjectHub,
  };
};
