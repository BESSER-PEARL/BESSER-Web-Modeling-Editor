import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { WifiOff, Wifi, X } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { Z_INDEX } from '../../constants/z-index';

/**
 * Duration (ms) the "Back online" success banner stays visible before
 * auto-dismissing.
 */
const RECONNECTED_DISPLAY_MS = 3000;

type BannerState = 'hidden' | 'offline' | 'reconnected';

/**
 * A fixed banner rendered at the top of the viewport that warns users when
 * their network connection is lost.
 *
 * Behavior:
 * - Shows an amber warning when the browser goes offline.
 * - Users can dismiss the warning; it reappears if they go offline again.
 * - When connectivity is restored, briefly shows a green "Back online"
 *   message that auto-hides after {@link RECONNECTED_DISPLAY_MS}.
 *
 * Mount this component once near the root of the React tree (e.g. inside
 * `AppContentInner` in `application.tsx`, after the `<ToastContainer />`).
 */
export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [bannerState, setBannerState] = useState<BannerState>('hidden');
  const [dismissed, setDismissed] = useState(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track the previous online value so we can detect transitions.
  const prevOnlineRef = useRef(isOnline);

  useEffect(() => {
    const wasOnline = prevOnlineRef.current;
    prevOnlineRef.current = isOnline;

    // Clear any pending reconnect timer on every status change.
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (!isOnline) {
      // Went offline (or was already offline on mount).
      setDismissed(false);
      setBannerState('offline');
      return;
    }

    if (wasOnline === false && isOnline) {
      // Transitioned from offline to online.
      setBannerState('reconnected');
      reconnectTimerRef.current = setTimeout(() => {
        setBannerState('hidden');
      }, RECONNECTED_DISPLAY_MS);
      return;
    }

    // Was online and still online -- stay hidden.
    setBannerState('hidden');
  }, [isOnline]);

  // Cleanup timer on unmount.
  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    setBannerState('hidden');
  };

  // Nothing to render.
  if (bannerState === 'hidden' || (bannerState === 'offline' && dismissed)) {
    return null;
  }

  const isOffline = bannerState === 'offline';

  const banner = (
    <div
      role="alert"
      aria-live="assertive"
      style={{ zIndex: Z_INDEX.OVERLAY }}
      className={[
        // Layout
        'fixed inset-x-0 top-0 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium shadow-md',
        // Animate in
        'animate-[slideDown_0.3s_ease-out]',
        // Offline: amber/yellow
        isOffline
          ? 'bg-amber-500 text-white dark:bg-amber-600'
          : // Reconnected: green/success
            'bg-emerald-500 text-white dark:bg-emerald-600',
      ].join(' ')}
    >
      {isOffline ? (
        <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <Wifi className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}

      <span>
        {isOffline
          ? 'You are offline. Some features may not work.'
          : 'Back online.'}
      </span>

      {isOffline && (
        <button
          type="button"
          onClick={handleDismiss}
          className="ml-2 rounded p-0.5 transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
          aria-label="Dismiss offline warning"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return createPortal(banner, document.body);
};

export default OfflineBanner;
