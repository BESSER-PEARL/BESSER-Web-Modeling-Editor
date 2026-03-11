import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { BACKEND_URL } from '../../../constant';

interface UseGitHubStarOptions {
  isAuthenticated: boolean;
  githubSession: string | null;
}

export function useGitHubStar({ isAuthenticated, githubSession }: UseGitHubStarOptions) {
  const [hasStarred, setHasStarred] = useState(false);
  const [starLoading, setStarLoading] = useState(false);

  // Check star status on mount / auth change
  useEffect(() => {
    if (!isAuthenticated || !githubSession) return;
    const controller = new AbortController();
    fetch(`${BACKEND_URL}/github/star/status?session_id=${githubSession}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => { if (data.starred) setHasStarred(true); })
      .catch(() => {});
    return () => controller.abort();
  }, [isAuthenticated, githubSession]);

  const handleToggleStar = async () => {
    if (!githubSession || starLoading) return;
    setStarLoading(true);
    try {
      const method = hasStarred ? 'DELETE' : 'PUT';
      const res = await fetch(`${BACKEND_URL}/github/star?session_id=${githubSession}`, { method });
      if (res.ok) {
        setHasStarred(!hasStarred);
        if (!hasStarred) toast.success('Thanks for starring BESSER!');
      }
    } catch {
      toast.error('Failed to update star');
    } finally {
      setStarLoading(false);
    }
  };

  return {
    hasStarred,
    starLoading,
    handleToggleStar,
  };
}
