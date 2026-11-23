import React, { Suspense } from 'react';
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

/**
 * The BESSER Lab build's whole application (`LAB_BUILD=true`): home at `/`, a change at
 * `/c/:changeId`, settings and usage at `/settings`, all behind {@link LabAuthGate} and under
 * {@link LabHeader}. None of the public editor's shell, menus or dialogs.
 */
export const LabApplication: React.FC = () => (
  <BrowserRouter>
    <style>{LAB_MOTION_CSS}</style>
    <LabAuthGate>
      {/* The editor's frame: a fixed-height page whose main area scrolls, so a change can fill it with its canvas. */}
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <LabHeader />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <Suspense fallback={<SuspenseFallback />}>
            <Routes>
              <Route path="/" element={<LabHome />} />
              <Route path="/c/:changeId" element={<LabChangeView />} />
              <Route path="/settings" element={<LabSettingsPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </LabAuthGate>
    <ToastContainer />
    <GlobalConfirmProvider />
  </BrowserRouter>
);

export default LabApplication;
