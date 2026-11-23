import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { NotFound } from '../../shared/components/NotFound';
import { SuspenseFallback } from '../../shared/components/loading/SuspenseFallback';
import { GlobalConfirmProvider } from '../../shared/services/confirm/GlobalConfirmProvider';
import { LabAuthGate } from './LabAuthGate';
import { LabHeader } from './LabHeader';
import { LabHome } from './LabHome';

const LabChangeView = React.lazy(() => import('./LabChangeView'));
const LabSettingsPage = React.lazy(() => import('./LabSettingsPage'));

/** The lab screens' shared motion: a staggered rise-in and the running row's shimmer, both off under reduced motion. */
const LAB_MOTION_CSS = `
  .lab-rise{opacity:0;translate:0 12px;animation:labRise .7s cubic-bezier(.2,.7,.2,1) forwards}
  .lab-d1{animation-delay:.04s}.lab-d2{animation-delay:.12s}.lab-d3{animation-delay:.22s}.lab-d4{animation-delay:.32s}
  @keyframes labRise{to{opacity:1;translate:none}}
  .lab-shimmer{background:linear-gradient(180deg,transparent,hsl(var(--brand)),transparent);background-size:100% 200%;animation:labShimmer 1.6s linear infinite}
  @keyframes labShimmer{from{background-position:0 100%}to{background-position:0 -100%}}
  @media (prefers-reduced-motion:reduce){
    .lab-rise{opacity:1;translate:none;animation:none}
    .lab-shimmer{animation:none;background:hsl(var(--brand))}
  }
`;

/** The id of the change an address is in (`/c/<id>` and below), or null on a lab screen. */
export function changeIdOf(pathname: string): string | null {
  return /^\/c\/([0-9a-f]{12})(?:\/|$)/.exec(pathname)?.[1] ?? null;
}

/** Reached by a link to a change from a lab screen: hands over to the editor, which lives under the change's address. */
const EnterChange: React.FC<{ onEnter: () => void }> = ({ onEnter }) => {
  useEffect(onEnter, [onEnter]);
  return <SuspenseFallback />;
};

/**
 * The BESSER Lab build's whole application (`LAB_BUILD=true`), behind {@link LabAuthGate}. The lab's own screens
 * (the changes at `/`, settings and usage at `/settings`) sit under {@link LabHeader}. A change is the editor
 * itself: its router has `/c/<id>` as its base, so the editor's shell sees its usual addresses (`/` the canvas,
 * `/changes`, `/try`), and the history entry the home opened it with (its first message) is kept.
 */
export const LabApplication: React.FC = () => {
  const [changeId, setChangeId] = useState(() => changeIdOf(window.location.pathname));
  const follow = useCallback(() => setChangeId(changeIdOf(window.location.pathname)), []);
  // Back and forward between a change and a lab screen.
  useEffect(() => {
    window.addEventListener('popstate', follow);
    return () => window.removeEventListener('popstate', follow);
  }, [follow]);
  const leave = useCallback(
    (path: string) => {
      window.history.pushState(null, '', path);
      follow();
    },
    [follow],
  );

  return (
    <>
      <style>{LAB_MOTION_CSS}</style>
      {changeId ? (
        <BrowserRouter key={changeId} basename={`/c/${changeId}`}>
          <LabAuthGate>
            <Suspense fallback={<SuspenseFallback />}>
              <LabChangeView changeId={changeId} onLeave={leave} />
            </Suspense>
          </LabAuthGate>
          <GlobalConfirmProvider />
        </BrowserRouter>
      ) : (
        <BrowserRouter>
          <LabAuthGate>
            <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
              <LabHeader />
              <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                <Suspense fallback={<SuspenseFallback />}>
                  <Routes>
                    <Route path="/" element={<LabHome />} />
                    <Route path="/c/:changeId/*" element={<EnterChange onEnter={follow} />} />
                    <Route path="/settings" element={<LabSettingsPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </main>
            </div>
          </LabAuthGate>
          <GlobalConfirmProvider />
        </BrowserRouter>
      )}
      <ToastContainer />
    </>
  );
};

export default LabApplication;
