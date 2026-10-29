/** Length of a span in whole minutes. */
export function minutesBetween(startUtc: number, endUtc: number): number {
  return Math.round((endUtc - startUtc) / 60);
}

export type Span = { startUtc: number; endUtc: number };

/** Expected work in a day: work hours minus lunch. Both are "HH:MM" strings. */
export function expectedMinutes(s: { workStart: string; workEnd: string; lunchStart: string; lunchEnd: string }): number {
  const min = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return min(s.workEnd) - min(s.workStart) - (min(s.lunchEnd) - min(s.lunchStart));
}

/** Minutes of `entries` that fall inside the day [dayStartUtc, dayEndUtc). */
export function loggedMinutes(entries: Span[], dayStartUtc: number, dayEndUtc: number): number {
  const seconds = entries.reduce(
    (sum, e) => sum + Math.max(0, Math.min(e.endUtc, dayEndUtc) - Math.max(e.startUtc, dayStartUtc)),
    0,
  );
  return Math.round(seconds / 60);
}

/** "6h 30m", "8h", "45m". */
export function formatHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h && `${h}h`, (m || !h) && `${m}m`].filter(Boolean).join(" ");
}

/** Where `N` puts an Entry when nothing is selected: right after the last Entry of the day, or at `fallbackUtc`. */
export function nextFreeStart(entries: Span[], dayStartUtc: number, dayEndUtc: number, fallbackUtc: number): number {
  const ends = entries.filter((e) => e.startUtc >= dayStartUtc && e.startUtc < dayEndUtc).map((e) => e.endUtc);
  return ends.length ? Math.max(...ends) : fallbackUtc;
}
