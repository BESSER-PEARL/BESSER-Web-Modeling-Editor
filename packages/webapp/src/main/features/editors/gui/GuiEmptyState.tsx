import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Blocks, MessageSquare, SquarePlus, WandSparkles } from 'lucide-react';

export interface GuiEmptyStateClass {
  name: string;
  attributes: string[];
}

interface GuiEmptyStateProps {
  /** Classes of the referenced class diagram (empty when there is none yet). */
  classes: GuiEmptyStateClass[];
  onGenerate: () => void;
  onOpenBlocks: () => void;
  onDescribe: () => void;
  onAddClasses: () => void;
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** English-only plural for the illustrated page title ("Book" -> "Books"). */
export function pluralize(name: string): string {
  if (/[^aeiou]y$/i.test(name)) return `${name.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(name)) return `${name}es`;
  return `${name}s`;
}

/**
 * Empty-page state for the GUI editor. Signature: the user's own classes turn
 * into a screen (the first class becomes a page whose table columns are its
 * attributes). Rendered over the GrapesJS canvas only while the page has no
 * components; pointer events pass through to the canvas except on the cards,
 * so dropping a block still works. Built per the besser-signature-ui recipe
 * (see FirstRunLanding.tsx): end state is the default, motion only when the
 * user allows it, replay on hover of the main card.
 */
export const GuiEmptyState: React.FC<GuiEmptyStateProps> = ({ classes, onGenerate, onOpenBlocks, onDescribe, onAddClasses }) => {
  const { t } = useTranslation();
  const [playKey, setPlayKey] = useState(0);
  const [lastPlay, setLastPlay] = useState(0);
  const replay = useCallback(() => {
    const now = Date.now();
    if (now - lastPlay < 2200) return;
    setLastPlay(now);
    setPlayKey((k) => k + 1);
  }, [lastPlay]);

  const hasClasses = classes.length > 0;
  const picked = classes.find((c) => c.attributes.length > 0) ?? classes[0];
  const others = classes.filter((c) => c !== picked).slice(0, 2);
  const columns = (picked?.attributes ?? []).slice(0, 3);
  const pageTitle = picked ? clip(pluralize(picked.name), 14) : '';
  const names = classes.slice(0, 3).map((c) => c.name).join(', ') + (classes.length > 3 ? ', …' : '');

  return (
    <div
      className="ges pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-auto bg-background p-6 text-foreground"
      // The GrapesJS canvas sets its own font; use the app's.
      style={{ fontFamily: "'Sora', system-ui, sans-serif" }}
    >
      <style>{`
        .ges-grid{background-image:linear-gradient(hsl(var(--brand)/.12) 1px,transparent 1px),linear-gradient(90deg,hsl(var(--brand)/.12) 1px,transparent 1px);background-size:26px 26px;-webkit-mask-image:radial-gradient(ellipse at center,#000 30%,transparent 75%);mask-image:radial-gradient(ellipse at center,#000 30%,transparent 75%)}
        .ges svg text{font-family:'IBM Plex Mono',ui-monospace,monospace}
        .ges .f-title{font-family:'Instrument Serif',Georgia,serif}
        .ges .f-btn-t{font-family:'Sora',system-ui,sans-serif}
        @media (prefers-reduced-motion:no-preference){
          .ges-play .a-rise{animation:gesRise .55s cubic-bezier(.2,.7,.2,1) both}
          .ges-play .a-pick rect.f-box{animation:gesPick .5s .55s ease-out both}
          .ges-play .a-edge{stroke-dasharray:120;animation:gesDraw .6s .8s cubic-bezier(.6,0,.2,1) both}
          .ges-play .a-fade{animation:gesFade .3s 1.3s ease-out both}
          .ges-play .a-screen{animation:gesPop .45s 1.05s cubic-bezier(.2,.7,.2,1) both;transform-box:fill-box;transform-origin:left center}
          .ges-play .a-pop{animation:gesPop .35s cubic-bezier(.2,.7,.2,1) both;transform-box:fill-box;transform-origin:center}
          .ges-d1{animation-delay:.04s!important}.ges-d2{animation-delay:.1s!important}.ges-d3{animation-delay:.16s!important}
          .ges-d4{animation-delay:.22s!important}.ges-d5{animation-delay:.3s!important}.ges-d6{animation-delay:.36s!important}
          .ges-w1{animation-delay:1.25s!important}.ges-w2{animation-delay:1.38s!important}.ges-w3{animation-delay:1.48s!important}
          .ges-w4{animation-delay:1.58s!important}.ges-w5{animation-delay:1.7s!important}.ges-w6{animation-delay:1.85s!important}
        }
        @keyframes gesRise{from{opacity:0;translate:0 10px}to{opacity:1;translate:0 0}}
        @keyframes gesPick{from{stroke:hsl(var(--border));stroke-width:1.3}to{stroke:hsl(var(--brand));stroke-width:1.6}}
        @keyframes gesDraw{from{stroke-dashoffset:120}to{stroke-dashoffset:0}}
        @keyframes gesFade{from{opacity:0}to{opacity:1}}
        @keyframes gesPop{from{opacity:0;scale:.96}to{opacity:1;scale:1}}
      `}</style>

      <div key={playKey} className="ges-play relative grid w-full max-w-3xl justify-items-center gap-5 text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-20 size-80 rounded-full opacity-70 blur-xl"
          style={{ background: 'radial-gradient(circle, hsl(var(--brand)/0.14), transparent 65%)' }}
        />

        {/* Signature: your classes become a screen */}
        <div className="relative aspect-[560/230] w-full max-w-[560px]" aria-hidden="true">
          <div className="ges-grid absolute inset-0 rounded-2xl" />
          <svg className="relative size-full overflow-visible" viewBox="0 0 560 230">
            {hasClasses && picked ? (
              <>
                {others[0] && (
                  <g className="a-rise ges-d1 opacity-55">
                    <rect className="fill-card stroke-border" strokeWidth={1.3} x="8" y="6" width="104" height="52" rx="6" />
                    <path className="fill-muted" d="M8 12a6 6 0 0 1 6-6h92a6 6 0 0 1 6 6v10H8z" />
                    <text className="fill-foreground" style={{ fontSize: 10, fontWeight: 600 }} x="18" y="18">{clip(others[0].name, 14)}</text>
                    {others[0].attributes[0] && <text className="fill-muted-foreground" style={{ fontSize: 9 }} x="18" y="38">{clip(others[0].attributes[0], 14)}</text>}
                  </g>
                )}
                {others[1] && (
                  <g className="a-rise ges-d3 opacity-55">
                    <rect className="fill-card stroke-border" strokeWidth={1.3} x="22" y="172" width="104" height="52" rx="6" />
                    <path className="fill-muted" d="M22 178a6 6 0 0 1 6-6h92a6 6 0 0 1 6 6v10H22z" />
                    <text className="fill-foreground" style={{ fontSize: 10, fontWeight: 600 }} x="32" y="184">{clip(others[1].name, 14)}</text>
                    {others[1].attributes[0] && <text className="fill-muted-foreground" style={{ fontSize: 9 }} x="32" y="204">{clip(others[1].attributes[0], 14)}</text>}
                  </g>
                )}
                <g className="a-rise a-pick ges-d2">
                  <rect className="f-box fill-card stroke-brand" strokeWidth={1.6} x="48" y="66" width="140" height="98" rx="7" />
                  <path className="fill-brand/15" d="M48 73a7 7 0 0 1 7-7h126a7 7 0 0 1 7 7v13H48z" />
                  <text className="fill-foreground" style={{ fontSize: 10, fontWeight: 600 }} x="60" y="80">{clip(picked.name, 18)}</text>
                  <line className="stroke-border" x1="48" y1="86" x2="188" y2="86" />
                  {columns.map((attr, i) => (
                    <text key={attr + i} className="fill-muted-foreground" style={{ fontSize: 9 }} x="60" y={104 + i * 18}>{clip(attr, 18)}</text>
                  ))}
                </g>
              </>
            ) : (
              <g className="a-rise ges-d2">
                <rect className="fill-none stroke-border" strokeWidth={1.3} strokeDasharray="4 4" x="48" y="66" width="140" height="98" rx="7" />
                <text className="fill-muted-foreground" style={{ fontSize: 9.5, fontWeight: 500 }} x="118" y="112" textAnchor="middle">{t('editors.gui.emptyState.noClassesTitle')}</text>
                <text className="fill-muted-foreground" style={{ fontSize: 7.5 }} x="118" y="128" textAnchor="middle">{t('editors.gui.emptyState.noClassesHint')}</text>
              </g>
            )}

            <path className="a-edge fill-none stroke-brand" strokeWidth={1.6} strokeLinecap="round" strokeDasharray={hasClasses ? undefined : '4 5'} d="M190 115 C 222 115, 230 115, 262 115" />
            <path className="a-fade fill-brand" d="M262 110 l8 5 -8 5z" />
            {hasClasses && <text className="a-fade fill-brand" style={{ fontSize: 8.5, fontWeight: 500, letterSpacing: '0.14em' }} x="200" y="104">{t('editors.gui.emptyState.figureTag')}</text>}

            <g className="a-screen">
              <rect className="fill-card stroke-border" strokeWidth={1.3} x="276" y="12" width="276" height="206" rx="10" />
              <path className="fill-muted" d="M276 22a10 10 0 0 1 10-10h256a10 10 0 0 1 10 10v8H276z" />
              <circle className="fill-border" cx="288" cy="21" r="2.6" />
              <circle className="fill-border" cx="297" cy="21" r="2.6" />
              <circle className="fill-border" cx="306" cy="21" r="2.6" />
              {hasClasses && picked ? (
                <>
                  <text className="a-pop ges-w1 f-title fill-foreground" style={{ fontSize: 17 }} x="292" y="58">{pageTitle}</text>
                  <g className="a-pop ges-w2">
                    <rect className="fill-brand" x="462" y="44" width="76" height="20" rx="10" />
                    <text className="f-btn-t fill-background" style={{ fontSize: 8.5, fontWeight: 600 }} x="500" y="57" textAnchor="middle">
                      {clip(t('editors.gui.emptyState.newItem', { name: picked.name.toLowerCase() }), 16)}
                    </text>
                  </g>
                  {columns.map((attr, i) => (
                    <text key={attr + i} className={`a-pop fill-muted-foreground ges-w${3 + i}`} style={{ fontSize: 8.5, fontWeight: 500 }} x={292 + i * 90} y="88">{clip(attr, 12)}</text>
                  ))}
                  <line className="a-pop ges-w5 stroke-border" x1="292" y1="96" x2="538" y2="96" />
                  <g className="a-pop ges-w6">
                    {[108, 138, 168].map((y, row) => (
                      <g key={y}>
                        {columns.map((_, i) => (
                          <rect key={i} className="fill-muted" x={292 + i * 90} y={y} width={[78, 62, 40][(i + row) % 3]} height="7" rx="3.5" />
                        ))}
                        {row < 2 && <line className="stroke-border" x1="292" y1={y + 18} x2="538" y2={y + 18} />}
                      </g>
                    ))}
                  </g>
                </>
              ) : (
                <>
                  <rect className="a-pop ges-w1 fill-muted" x="292" y="46" width="110" height="12" rx="6" />
                  <rect className="a-pop ges-w2 fill-muted" x="472" y="44" width="66" height="20" rx="10" />
                  <rect className="a-pop ges-w3 fill-muted opacity-60" x="292" y="84" width="246" height="56" rx="8" />
                  <rect className="a-pop ges-w5 fill-muted opacity-60" x="292" y="152" width="118" height="52" rx="8" />
                  <rect className="a-pop ges-w6 fill-muted opacity-60" x="420" y="152" width="118" height="52" rx="8" />
                </>
              )}
            </g>
          </svg>
        </div>

        <div>
          <p className="a-rise ges-d3 font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-brand">{t('editors.gui.emptyState.eyebrow')}</p>
          <h2 className="a-rise ges-d4 mt-1.5 font-display text-[2.4rem] leading-[1.05] tracking-tight text-foreground" style={{ textWrap: 'balance' }}>
            {t('editors.gui.emptyState.title')}
          </h2>
          <p className="a-rise ges-d5 mx-auto mt-2 max-w-[50ch] text-sm text-muted-foreground">
            {hasClasses ? t('editors.gui.emptyState.subtitle') : t('editors.gui.emptyState.subtitleNoClasses')}
          </p>
        </div>

        <div className="a-rise ges-d6 pointer-events-auto grid w-full grid-cols-1 gap-3 text-left md:grid-cols-[1.25fr_1fr_1fr]">
          {hasClasses ? (
            <PathCard
              primary
              icon={<WandSparkles className="size-4" />}
              title={t('editors.gui.emptyState.generateTitle')}
              description={t('editors.gui.emptyState.generateDescription', { count: classes.length, names })}
              onClick={onGenerate}
              onMouseEnter={replay}
            />
          ) : (
            <PathCard
              primary
              icon={<SquarePlus className="size-4" />}
              title={t('editors.gui.emptyState.addClassesTitle')}
              description={t('editors.gui.emptyState.addClassesDescription')}
              onClick={onAddClasses}
              onMouseEnter={replay}
            />
          )}
          <PathCard
            icon={<Blocks className="size-4" />}
            title={t('editors.gui.emptyState.blocksTitle')}
            description={t('editors.gui.emptyState.blocksDescription')}
            onClick={onOpenBlocks}
          />
          <PathCard
            icon={<MessageSquare className="size-4" />}
            title={t('editors.gui.emptyState.describeTitle')}
            description={t('editors.gui.emptyState.describeDescription')}
            onClick={onDescribe}
          />
        </div>
        <p className="a-rise ges-d6 -mt-1 text-xs text-muted-foreground">{t('editors.gui.emptyState.footer')}</p>
      </div>
    </div>
  );
};

const PathCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  onMouseEnter?: () => void;
  primary?: boolean;
}> = ({ icon, title, description, onClick, onMouseEnter, primary = false }) => (
  <button
    type="button"
    onClick={onClick}
    onMouseEnter={onMouseEnter}
    className={[
      'group grid grid-cols-[auto_minmax(0,1fr)] content-start items-start gap-x-3 gap-y-1 rounded-xl border px-4 py-3.5 text-left',
      'transition-[transform,border-color,box-shadow,background-color] duration-200 ease-out active:scale-[0.98]',
      '[@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:shadow-elevation-2',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      primary ? 'border-brand/50 bg-brand/[0.06] hover:border-brand/70' : 'border-border bg-card hover:border-brand/40',
    ].join(' ')}
  >
    <span
      className={[
        'row-span-2 flex size-8 items-center justify-center rounded-lg',
        primary ? 'bg-brand text-brand-foreground' : 'bg-muted text-foreground',
      ].join(' ')}
      aria-hidden="true"
    >
      {icon}
    </span>
    <span className={['text-sm font-semibold', primary ? 'text-brand-dark dark:text-brand' : 'text-foreground'].join(' ')}>{title}</span>
    <span className="text-[12.5px] leading-snug text-muted-foreground">{description}</span>
  </button>
);
