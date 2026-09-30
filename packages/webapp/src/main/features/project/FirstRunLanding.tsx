import React, { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';

import { DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { InterfaceMode } from '../../shared/types/project';

interface FirstRunLandingProps {
  /** Fires when a portal is chosen — `remember` reflects the checkbox state. */
  onChoose: (mode: InterfaceMode, remember: boolean) => void;
  /** "More options" → the classic Project Hub start screen. */
  onMoreOptions: () => void;
  /** Pre-tick "Remember my choice" (e.g. the user set a default before). */
  defaultRemember?: boolean;
}

/**
 * First-run mode chooser: a brand-new user picks between the low-code modelling
 * canvas ("Model it") and the agentic assistant ("Describe it"). Rendered as the
 * `'welcome'` step inside {@link ProjectHubDialog}. Each portal speaks its
 * mode's own visual language — a UML class-diagram fragment on a grid vs. a
 * prompt typing itself into structure on a dot field — which is the signature.
 *
 * Built on BESSER's own tokens (font-display = Instrument Serif, font-mono =
 * IBM Plex Mono, brand teal); theme-aware via the app's class-based dark mode.
 */
export const FirstRunLanding: React.FC<FirstRunLandingProps> = ({
  onChoose,
  onMoreOptions,
  defaultRemember = false,
}) => {
  const [remember, setRemember] = useState(defaultRemember);

  return (
    <div className="frl relative flex max-h-[92vh] flex-col overflow-y-auto bg-background">
      <style>{`
        .frl-rise{opacity:0;transform:translateY(12px);animation:frlRise .7s cubic-bezier(.2,.7,.2,1) forwards}
        .frl-d1{animation-delay:.04s}.frl-d2{animation-delay:.12s}.frl-d3{animation-delay:.22s}
        .frl-d4{animation-delay:.32s}.frl-d5{animation-delay:.42s}.frl-d6{animation-delay:.54s}
        @keyframes frlRise{to{opacity:1;transform:none}}
        .frl-edge{stroke-dasharray:150;stroke-dashoffset:150;animation:frlDraw 1.1s .5s cubic-bezier(.6,0,.2,1) forwards}
        .frl-card-model:hover .frl-edge,.frl-card-model:focus-visible .frl-edge{animation:frlDraw .9s cubic-bezier(.6,0,.2,1) forwards}
        @keyframes frlDraw{to{stroke-dashoffset:0}}
        .frl-typed{white-space:nowrap;overflow:hidden;border-right:2px solid hsl(var(--brand));width:19ch;max-width:100%;
          animation:frlType 1.9s .5s steps(19) both, frlCaret .8s steps(1) 5 .5s}
        .frl-card-agent:hover .frl-typed,.frl-card-agent:focus-visible .frl-typed{animation:frlType 1.3s steps(19) both, frlCaret .8s steps(1) 3}
        @keyframes frlType{from{width:0}to{width:19ch}}
        @keyframes frlCaret{50%{border-color:transparent}}
        .frl-built{opacity:0;animation:frlPop .5s 2.3s forwards}
        .frl-card-agent:hover .frl-built,.frl-card-agent:focus-visible .frl-built{animation:frlPop .4s 1.3s forwards}
        @keyframes frlPop{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @media (prefers-reduced-motion:reduce){
          .frl-rise{opacity:1;transform:none;animation:none}
          .frl-edge{stroke-dashoffset:0;animation:none}
          .frl-typed{width:19ch;border-right-color:transparent;animation:none}
          .frl-built{opacity:1;animation:none}
        }
      `}</style>

      {/* Radix requires a title for the dialog; the visible hero is the heading. */}
      <DialogTitle className="sr-only">Choose how you want to build</DialogTitle>

      {/* ambient teal glow + grain, matching the app's welcome surfaces */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 size-80 rounded-full opacity-50 blur-2xl"
        style={{ background: 'radial-gradient(circle at center, hsl(var(--brand)/0.22), transparent 62%)' }}
      />
      <div aria-hidden className="grain-overlay pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative z-[1] px-6 py-7 sm:px-9 sm:py-9">
        <p className="frl-rise frl-d1 font-mono text-[0.7rem] uppercase tracking-[0.28em] text-brand">
          Welcome to BESSER
        </p>
        <h1
          className="frl-rise frl-d2 mt-3 font-display text-4xl leading-[1.02] tracking-tight text-foreground sm:text-5xl"
          style={{ textWrap: 'balance' }}
        >
          How do you want to <em className="text-primary">build</em>?
        </h1>
        <p className="frl-rise frl-d3 mt-3 max-w-[46ch] text-muted-foreground">
          Two ways into the same editor. Choose one to begin — you can switch anytime.
        </p>

        {/* ---- the two portals ---- */}
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {/* MODEL IT */}
          <button
            type="button"
            onClick={() => onChoose('model', remember)}
            className="frl-card-model frl-rise frl-d4 group relative flex min-h-[300px] flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 text-left transition-all duration-500 hover:-translate-y-1.5 hover:border-brand/50 hover:shadow-elevation-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{
                backgroundImage:
                  'linear-gradient(hsl(var(--brand)/0.10) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--brand)/0.10) 1px, transparent 1px)',
                backgroundSize: '26px 26px',
                maskImage: 'linear-gradient(180deg,#000,transparent 78%)',
                WebkitMaskImage: 'linear-gradient(180deg,#000,transparent 78%)',
              }}
            />
            <span className="relative mb-auto font-mono text-[0.68rem] uppercase tracking-[0.2em] text-brand">
              Low-code · Visual
            </span>
            <div aria-hidden className="relative my-4 h-[120px]">
              <svg className="h-full w-full overflow-visible" viewBox="0 0 300 130" preserveAspectRatio="xMidYMid meet" role="img" aria-label="A UML class diagram">
                <g>
                  <rect className="fill-muted stroke-border" strokeWidth={1.4} x="4" y="20" width="104" height="78" rx="6" />
                  <path className="fill-brand/20" d="M4 26a6 6 0 0 1 6-6h92a6 6 0 0 1 6 6v10H4z" />
                  <text className="fill-foreground font-mono" style={{ fontSize: 8.5, fontWeight: 600 }} x="16" y="33">Book</text>
                  <line className="stroke-border" x1="4" y1="52" x2="108" y2="52" />
                  <rect className="fill-muted-foreground/50" x="16" y="60" width="60" height="4" rx="2" />
                  <rect className="fill-muted-foreground/50" x="16" y="72" width="74" height="4" rx="2" />
                  <rect className="fill-muted-foreground/50" x="16" y="84" width="48" height="4" rx="2" />
                </g>
                <g>
                  <rect className="fill-muted stroke-border" strokeWidth={1.4} x="192" y="34" width="104" height="78" rx="6" />
                  <path className="fill-brand/20" d="M192 40a6 6 0 0 1 6-6h92a6 6 0 0 1 6 6v10h-104z" />
                  <text className="fill-foreground font-mono" style={{ fontSize: 8.5, fontWeight: 600 }} x="204" y="47">Loan</text>
                  <line className="stroke-border" x1="192" y1="66" x2="296" y2="66" />
                  <rect className="fill-muted-foreground/50" x="204" y="74" width="66" height="4" rx="2" />
                  <rect className="fill-muted-foreground/50" x="204" y="86" width="52" height="4" rx="2" />
                  <rect className="fill-muted-foreground/50" x="204" y="98" width="70" height="4" rx="2" />
                </g>
                <polyline className="frl-edge fill-none stroke-brand" strokeWidth={1.7} points="108,60 150,60 150,73 192,73" />
                <circle className="fill-brand" cx="108" cy="60" r="2.4" />
                <circle className="fill-brand" cx="192" cy="73" r="2.4" />
                <text className="fill-primary font-mono" style={{ fontSize: 8 }} x="114" y="55">1</text>
                <text className="fill-primary font-mono" style={{ fontSize: 8 }} x="181" y="68">*</text>
              </svg>
            </div>
            <h2 className="relative text-2xl font-semibold tracking-tight text-foreground">Model it</h2>
            <p className="relative mt-2 max-w-[34ch] text-sm text-muted-foreground">
              Draw your system precisely — classes, relationships, screens. Deterministic output, exact every run.
            </p>
            <div className="relative mt-5 flex items-center justify-end gap-3">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                Start modelling
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </div>
          </button>

          {/* DESCRIBE IT */}
          <button
            type="button"
            onClick={() => onChoose('agent', remember)}
            className="frl-card-agent frl-rise frl-d5 group relative flex min-h-[300px] flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 text-left transition-all duration-500 hover:-translate-y-1.5 hover:border-brand/50 hover:shadow-elevation-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{
                backgroundImage: 'radial-gradient(hsl(var(--brand)/0.22) 1.4px, transparent 1.6px)',
                backgroundSize: '20px 20px',
                backgroundPosition: '6px 6px',
                maskImage: 'radial-gradient(130% 90% at 90% 12%,#000,transparent 72%)',
                WebkitMaskImage: 'radial-gradient(130% 90% at 90% 12%,#000,transparent 72%)',
              }}
            />
            <span className="relative mb-auto font-mono text-[0.68rem] uppercase tracking-[0.2em] text-brand">
              Agentic · Natural language
            </span>
            <div aria-hidden className="relative my-4 flex h-[120px] flex-col justify-center gap-3.5">
              <div className="flex min-h-[40px] items-center gap-2.5 rounded-xl border border-border bg-muted px-3.5 py-2.5 font-mono text-[0.8rem] text-foreground">
                <span
                  className="size-[7px] shrink-0 rounded-full bg-brand"
                  style={{ boxShadow: '0 0 0 4px hsl(var(--brand)/0.2)' }}
                />
                <span className="frl-typed">a hotel booking app</span>
              </div>
              <div className="frl-built flex items-center gap-2">
                <span className="h-[22px] w-[52px] rounded-md border border-brand/30 bg-brand/15" />
                <span className="h-[22px] w-[38px] rounded-md border border-brand/30 bg-brand/15" />
                <span className="h-[22px] w-[64px] rounded-md border border-brand/30 bg-brand/15" />
                <span className="font-mono text-[0.8rem] text-muted-foreground">→ app</span>
              </div>
            </div>
            <h2 className="relative text-2xl font-semibold tracking-tight text-foreground">Describe it</h2>
            <p className="relative mt-2 max-w-[34ch] text-sm text-muted-foreground">
              Say what you want in plain words. BESSER builds the model and the code — you refine by chatting.
            </p>
            <div className="relative mt-5 flex items-center justify-between gap-3">
              <span className="rounded-full border border-brand/20 bg-accent px-2.5 py-1 font-mono text-[0.68rem] tracking-wide text-primary">
                Free · hosted Qwen
              </span>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                Start describing
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </div>
          </button>
        </div>

        {/* ---- remember + more options ---- */}
        <div className="frl-rise frl-d6 mt-5 flex flex-wrap items-center justify-between gap-3">
          <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span
              className={cn(
                'grid size-5 place-items-center rounded-md border-[1.6px] transition peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
                remember ? 'border-primary bg-primary' : 'border-input bg-background',
              )}
            >
              <Check className={cn('size-3 text-primary-foreground transition-opacity', remember ? 'opacity-100' : 'opacity-0')} />
            </span>
            Remember my choice and skip this next time
          </label>
          <button
            type="button"
            onClick={onMoreOptions}
            className="text-sm font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            More options
          </button>
        </div>
      </div>
    </div>
  );
};
