// Jediný sdílený výpočet dnů dovolené. Všechna místa v aplikaci (docházka,
// směny, bilance, analytiky, exporty) musí používat tyto funkce, aby se
// dovolené počítaly a zobrazovaly všude stejně.
//
// Zásady:
// - datumy se expandují přes lokální formátování (nikdy toISOString na lokálním
//   Date — v Praze by to posunulo každý den o jeden zpět)
// - víkendy se započítávají jen když vacation_counting_mode === 'all'
// - počítání přes Set unikátních dnů → překrývající se žádosti se nepočítají dvakrát

/** Formats a Date as local YYYY-MM-DD. Never use toISOString for this. */
export function toISODateLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Day of week (0=Sun … 6=Sat) for a YYYY-MM-DD string, timezone-safe. */
export function dayOfWeekISO(iso: string): number {
  return new Date(iso + 'T12:00:00').getDay();
}

export function isWeekendISO(iso: string): boolean {
  const dow = dayOfWeekISO(iso);
  return dow === 0 || dow === 6;
}

/** Expands an inclusive date range into YYYY-MM-DD strings (max ~3 years as a runaway guard). */
export function eachDayISO(dateFrom: string, dateTo?: string | null): string[] {
  const to = dateTo && dateTo > dateFrom ? dateTo : dateFrom;
  const days: string[] = [];
  const cur = new Date(dateFrom + 'T12:00:00');
  let iso = toISODateLocal(cur);
  while (iso <= to && days.length < 1100) {
    days.push(iso);
    cur.setDate(cur.getDate() + 1);
    iso = toISODateLocal(cur);
  }
  return days;
}

/**
 * Vacation days of one request: honors the weekend-counting mode and an
 * optional clip window (e.g. to keep only days inside one year/month).
 */
export function vacationDaysInRange(
  dateFrom: string,
  dateTo: string | null | undefined,
  countWeekends: boolean,
  clip?: { start?: string; end?: string },
): string[] {
  return eachDayISO(dateFrom, dateTo).filter((iso) => {
    if (!countWeekends && isWeekendISO(iso)) return false;
    if (clip?.start && iso < clip.start) return false;
    if (clip?.end && iso > clip.end) return false;
    return true;
  });
}

/** Unique vacation-day count across many requests (dedups overlapping ranges). */
export function countUniqueVacationDays(
  requests: { date_from: string; date_to?: string | null }[],
  countWeekends: boolean,
  clip?: { start?: string; end?: string },
): number {
  const set = new Set<string>();
  for (const r of requests) {
    for (const iso of vacationDaysInRange(r.date_from, r.date_to, countWeekends, clip)) set.add(iso);
  }
  return set.size;
}
