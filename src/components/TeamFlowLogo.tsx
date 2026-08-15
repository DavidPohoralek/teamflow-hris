// TeamFlow brand mark (the tab/badge monogram). Two variants:
//   'light' — original dark badge, for light backgrounds (kiosk, paper sidebar)
//   'dark'  — B + thin white outline, for dark backgrounds (graphite/ink sidebar)
export function TeamFlowMark({ variant = 'light', className = 'w-[22px] h-[22px]' }: { variant?: 'light' | 'dark'; className?: string }) {
  const c = variant === 'dark'
    ? { badge: '#323d48', corner: '#E8963C', letter: '#FFFFFF', accent: '#E8963C', outline: '#FFFFFF' }
    : { badge: '#23282E', corner: '#E8963C', letter: '#FFFFFF', accent: '#C97C2A', outline: 'none' };
  return (
    <svg viewBox="0 0 96 96" className={className} role="img" aria-label="TeamFlow">
      <path d="M10 8h60l16 16v48l-16 16H10z" fill={c.badge} />
      <path d="M70 8l16 16H70z" fill={c.corner} />
      <path d="M24 30h48v13H55v37H41V43H24z" fill={c.letter} />
      <path d="M38.5 43h2.5v37h-2.5z" fill={c.accent} />
      {c.outline !== 'none' && (
        <path d="M10 8h60l16 16v48l-16 16H10z" fill="none" stroke={c.outline} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}

// "TeamFlow" wordmark with the orange "Flow" — colours adapt to the surface.
export function TeamFlowWordmark({ dark = false, className = 'text-[15px] font-semibold tracking-tight' }: { dark?: boolean; className?: string }) {
  return (
    <span className={className} style={{ color: dark ? '#ffffff' : '#111820' }}>
      Team<span style={{ color: dark ? '#E8963C' : '#C97C2A' }}>Flow</span>
    </span>
  );
}
