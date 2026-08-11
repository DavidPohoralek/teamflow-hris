// Custom line icons for the main navigation — replaces emoji so the bar looks
// deliberate across platforms. Stroke follows currentColor, so they inherit the
// active/inactive tab text color automatically.

const STROKE = 1.8;

const ICONS: Record<string, React.ReactNode> = {
  // Příchod/Odchod — clock with a check-in arrow
  attendance: (
    <>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.75V12l3 1.75" />
    </>
  ),
  // Přehled — three ascending bars
  overview: (
    <>
      <path d="M4 19.5h16" />
      <path d="M7 19.5v-6M12 19.5V4.5M17 19.5v-9" />
    </>
  ),
  // Směny — calendar grid
  schedule: (
    <>
      <rect x="3.75" y="5" width="16.5" height="15" rx="2" />
      <path d="M3.75 9.5h16.5M8.5 2.75V6M15.5 2.75V6" />
      <path d="M8 13h2M14 13h2M8 16.5h2" />
    </>
  ),
  // Dovolená — sun over waves
  vacation: (
    <>
      <circle cx="12" cy="9" r="3.25" />
      <path d="M12 2.75V4.4M17.3 5.7l-1.15 1.15M21.25 11h-1.65M6.85 6.85 5.7 5.7M4.4 11H2.75" />
      <path d="M3 16.5c1.5 1.4 3 1.4 4.5 0s3-1.4 4.5 0 3 1.4 4.5 0 3-1.4 4.5 0" />
      <path d="M3 20c1.5 1.4 3 1.4 4.5 0s3-1.4 4.5 0 3 1.4 4.5 0 3-1.4 4.5 0" />
    </>
  ),
  // Zaměstnanec — person
  'my-hours': (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20.25c0-3.6 3.1-6 7-6s7 2.4 7 6" />
    </>
  ),
  // Analytika — trend line with points
  analytics: (
    <>
      <path d="M3.75 19.5 9 13.75l3.75 3L20.25 8.5" />
      <circle cx="9" cy="13.75" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12.75" cy="16.75" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="20.25" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  // Asistent — sparkles
  assistant: (
    <>
      <path d="M12 4.5 13.6 9l4.4 1.6-4.4 1.6L12 16.5l-1.6-4.3L6 10.6 10.4 9 12 4.5Z" />
      <path d="M18.75 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
    </>
  ),
  // Správa — gear
  management: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4.25v2M12 17.75v2M19.75 12h-2M6.25 12h-2M17.5 6.5l-1.4 1.4M7.9 16.1l-1.4 1.4M17.5 17.5l-1.4-1.4M7.9 7.9 6.5 6.5" />
    </>
  ),
};

export default function TabIcon({ id, className }: { id: string; className?: string }) {
  const icon = ICONS[id];
  if (!icon) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'w-[18px] h-[18px]'}
      aria-hidden
    >
      {icon}
    </svg>
  );
}
