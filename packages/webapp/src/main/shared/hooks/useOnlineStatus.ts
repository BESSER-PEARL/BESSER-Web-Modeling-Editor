import { useState, useEffect } from 'react';

/**
 * Tracks browser online/offline connectivity via the Navigator API.
 *
 * Returns `true` when the browser reports a network connection and `false`
 * when the connection is lost. The hook subscribes to the `online` and
 * `offline` window events so the value updates in real time.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
